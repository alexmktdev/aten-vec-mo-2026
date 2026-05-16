import {
  isUpstashEnabled,
  upstashDeleteByPrefix,
  upstashGet,
  upstashSetEx,
} from "@/lib/kv/upstash-rest";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const GLOBAL_CACHE_KEY = "__avv_server_cache_store__";
const MAX_CACHE_ENTRIES = 5_000;

function getCacheStore(): Map<string, CacheEntry<unknown>> {
  const runtime = globalThis as typeof globalThis & {
    [GLOBAL_CACHE_KEY]?: Map<string, CacheEntry<unknown>>;
  };
  if (!runtime[GLOBAL_CACHE_KEY]) {
    runtime[GLOBAL_CACHE_KEY] = new Map<string, CacheEntry<unknown>>();
  }
  return runtime[GLOBAL_CACHE_KEY];
}

function compactExpiredEntries(store: Map<string, CacheEntry<unknown>>, now: number): void {
  if (store.size < MAX_CACHE_ENTRIES) return;
  for (const [key, value] of store) {
    if (value.expiresAt <= now) store.delete(key);
  }
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  if (isUpstashEnabled()) {
    try {
      const cachedValue = await upstashGet(key);
      if (cachedValue !== null) {
        return JSON.parse(cachedValue) as T;
      }
      const value = await loader();
      await upstashSetEx(key, Math.max(1, Math.ceil(ttlMs / 1000)), JSON.stringify(value));
      return value;
    } catch {
      // Fallback to local cache when distributed cache is unavailable.
    }
  }

  const store = getCacheStore();
  const now = Date.now();
  compactExpiredEntries(store, now);
  const current = store.get(key) as CacheEntry<T> | undefined;
  if (current && current.expiresAt > now) return current.value;

  const value = await loader();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function invalidateCacheByPrefix(prefix: string): void {
  if (isUpstashEnabled()) {
    void upstashDeleteByPrefix(prefix).catch(() => {
      // Fallback keeps running even if remote invalidation fails.
    });
  }

  const store = getCacheStore();
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}
