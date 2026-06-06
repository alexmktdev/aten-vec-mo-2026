import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createErrorResponse } from "@/lib/utils/response";
import logger from "@/lib/logger";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitDuration = `${number} s` | `${number} m` | `${number} h` | `${number} d`;

const GLOBAL_BUCKETS_KEY = "__avv_rate_limit_buckets__";
const MAX_BUCKETS = 10_000;

/** Presets documentados — usados en rutas públicas y auth. */
export const RATE_LIMIT_PRESETS = {
  seguimiento: { maxRequests: 30, windowMs: 60_000 },
  requerimientosCreate: { maxRequests: 15, windowMs: 60_000 },
  upload: { maxRequests: 20, windowMs: 60_000 },
  documentos: { maxRequests: 30, windowMs: 60_000 },
  authSession: { maxRequests: 20, windowMs: 60_000 },
  passwordReset: { maxRequests: 5, windowMs: 60_000 },
  passwordResetConfirm: { maxRequests: 5, windowMs: 60_000 },
} as const;

function getBucketsStore(): Map<string, RateLimitBucket> {
  const runtime = globalThis as typeof globalThis & {
    [GLOBAL_BUCKETS_KEY]?: Map<string, RateLimitBucket>;
  };
  if (!runtime[GLOBAL_BUCKETS_KEY]) {
    runtime[GLOBAL_BUCKETS_KEY] = new Map<string, RateLimitBucket>();
  }
  return runtime[GLOBAL_BUCKETS_KEY];
}

function compactBuckets(buckets: Map<string, RateLimitBucket>, now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, value] of buckets) {
    if (value.resetAt <= now) buckets.delete(key);
  }
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

export function isUpstashRateLimitEnabled(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function windowMsToDuration(windowMs: number): RateLimitDuration {
  const seconds = Math.max(1, Math.ceil(windowMs / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} m`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.ceil(hours / 24);
  return `${days} d`;
}

let redisClient: Redis | null = null;
const limiterCache = new Map<string, Ratelimit>();

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }
  return redisClient;
}

function getUpstashLimiter(keyPrefix: string, maxRequests: number, windowMs: number): Ratelimit {
  const cacheKey = `${keyPrefix}:${maxRequests}:${windowMs}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis: getRedisClient(),
    limiter: Ratelimit.slidingWindow(maxRequests, windowMsToDuration(windowMs)),
    prefix: `ratelimit:${keyPrefix}`,
    analytics: true,
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

let loggedLocalFallback = false;

function logLocalFallbackOnce(): void {
  if (loggedLocalFallback) return;
  loggedLocalFallback = true;
  if (process.env.NODE_ENV === "production") {
    logger.warn(
      "UPSTASH_REDIS_REST_URL/TOKEN no configurados: rate limit en memoria del proceso (no global en serverless)"
    );
  }
}

export async function checkRateLimit(
  request: NextRequest,
  keyPrefix: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSeconds: number; limit: number; remaining: number }> {
  const ip = getClientIp(request);

  if (isUpstashRateLimitEnabled()) {
    try {
      const limiter = getUpstashLimiter(keyPrefix, maxRequests, windowMs);
      const result = await limiter.limit(ip);
      const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
      return {
        allowed: result.success,
        retryAfterSeconds,
        limit: result.limit,
        remaining: result.remaining,
      };
    } catch (error) {
      logger.error({ error, keyPrefix }, "Upstash rate limit failed, using local fallback");
    }
  } else {
    logLocalFallbackOnce();
  }

  const local = runLocalRateLimit(request, keyPrefix, maxRequests, windowMs);
  return {
    ...local,
    limit: maxRequests,
    remaining: local.allowed ? Math.max(0, maxRequests - 1) : 0,
  };
}

function runLocalRateLimit(
  request: NextRequest,
  keyPrefix: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const buckets = getBucketsStore();
  compactBuckets(buckets, now);
  const ip = getClientIp(request);
  const key = `${keyPrefix}:${ip}`;

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  buckets.set(key, existing);
  return { allowed: true, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
}

/** Devuelve respuesta 429 con Retry-After o null si la solicitud está permitida. */
export async function enforceRateLimit(
  request: NextRequest,
  keyPrefix: string,
  maxRequests: number,
  windowMs: number,
  message = "Demasiadas solicitudes. Intente nuevamente más tarde."
): Promise<NextResponse | null> {
  const rate = await checkRateLimit(request, keyPrefix, maxRequests, windowMs);
  if (rate.allowed) return null;

  const response = createErrorResponse(
    429,
    `${message} Reintente en ${rate.retryAfterSeconds}s.`
  );
  response.headers.set("Retry-After", String(rate.retryAfterSeconds));
  response.headers.set("X-RateLimit-Limit", String(rate.limit));
  response.headers.set("X-RateLimit-Remaining", String(rate.remaining));
  return response;
}
