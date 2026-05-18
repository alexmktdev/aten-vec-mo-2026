import { unstable_cache, updateTag } from "next/cache";
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

function getTagFromKey(key: string): string {
  const parts = key.split(":");
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return parts[0];
}

function localCacheFallback<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const store = getCacheStore();
  const now = Date.now();
  compactExpiredEntries(store, now);
  const current = store.get(key) as CacheEntry<T> | undefined;
  if (current && current.expiresAt > now) return Promise.resolve(current.value);

  return loader().then((value) => {
    store.set(key, { value, expiresAt: now + ttlMs });
    return value;
  });
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const tag = getTagFromKey(key);
  const revalidateSeconds = Math.max(1, Math.ceil(ttlMs / 1000));

  try {
    const getCachedValue = unstable_cache(
      loader,
      [key],
      { revalidate: revalidateSeconds, tags: [tag] }
    );
    return await getCachedValue() as T;
  } catch {
    // unstable_cache unavailable (edge runtime, tests, etc.) — try Upstash or local
  }

  if (isUpstashEnabled()) {
    try {
      const cachedValue = await upstashGet(key);
      if (cachedValue !== null) {
        return JSON.parse(cachedValue) as T;
      }
      const value = await loader();
      await upstashSetEx(key, revalidateSeconds, JSON.stringify(value));
      return value;
    } catch {
      // Fallback to local cache when distributed cache is unavailable.
    }
  }

  return localCacheFallback(key, ttlMs, loader);
}

export function invalidateCacheByPrefix(prefix: string): void {
  const tag = prefix.replace(/:$/, "");
  const rootTag = tag.split(":")[0];
  try {
    updateTag(tag);
    if (rootTag && rootTag !== tag) {
      // Backward compatibility with entries tagged before this change.
      updateTag(rootTag);
    }
  } catch {
    // revalidateTag unavailable outside request context
  }

  if (isUpstashEnabled()) {
    void upstashDeleteByPrefix(prefix).catch(() => {});
  }

  const store = getCacheStore();
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}
