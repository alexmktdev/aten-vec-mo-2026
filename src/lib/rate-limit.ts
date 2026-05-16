import { NextRequest } from "next/server";
import { isUpstashEnabled, upstashIncrWithWindow } from "@/lib/kv/upstash-rest";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const GLOBAL_BUCKETS_KEY = "__avv_rate_limit_buckets__";
const MAX_BUCKETS = 10_000;

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

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

export async function checkRateLimit(
  request: NextRequest,
  keyPrefix: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  if (!isUpstashEnabled()) {
    return runLocalRateLimit(request, keyPrefix, maxRequests, windowMs);
  }

  try {
    const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    const ip = getClientIp(request);
    const key = `ratelimit:${keyPrefix}:${ip}`;
    const { count, ttlSeconds } = await upstashIncrWithWindow(key, windowSeconds);
    if (count > maxRequests) {
      return { allowed: false, retryAfterSeconds: ttlSeconds };
    }
    return { allowed: true, retryAfterSeconds: ttlSeconds };
  } catch {
    return runLocalRateLimit(request, keyPrefix, maxRequests, windowMs);
  }
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
