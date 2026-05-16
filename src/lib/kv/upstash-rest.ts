type RedisArg = string | number;
type RedisCommand = [string, ...RedisArg[]];

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

async function pipeline(commands: RedisCommand[]): Promise<Array<{ result?: unknown; error?: string }>> {
  const config = getUpstashConfig();
  if (!config) {
    throw new Error("Upstash Redis is not configured");
  }

  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash pipeline failed with status ${response.status}`);
  }

  const json = (await response.json()) as Array<{ result?: unknown; error?: string }>;
  return json;
}

export function isUpstashEnabled(): boolean {
  return Boolean(getUpstashConfig());
}

export async function upstashGet(key: string): Promise<string | null> {
  const rows = await pipeline([["GET", key]]);
  const row = rows[0];
  if (row?.error) throw new Error(row.error);
  if (row?.result == null) return null;
  return String(row.result);
}

export async function upstashSetEx(key: string, ttlSeconds: number, value: string): Promise<void> {
  const rows = await pipeline([["SETEX", key, ttlSeconds, value]]);
  const row = rows[0];
  if (row?.error) throw new Error(row.error);
}

export async function upstashDeleteByPrefix(prefix: string): Promise<number> {
  const keysRow = (await pipeline([["KEYS", `${prefix}*`]]))[0];
  if (keysRow?.error) throw new Error(keysRow.error);
  const keys = Array.isArray(keysRow?.result)
    ? (keysRow.result as unknown[]).map((k) => String(k))
    : [];
  if (keys.length === 0) return 0;

  const deleteRows = await pipeline([["DEL", ...keys]]);
  const row = deleteRows[0];
  if (row?.error) throw new Error(row.error);
  return Number(row?.result || 0);
}

export async function upstashIncrWithWindow(
  key: string,
  windowSeconds: number
): Promise<{ count: number; ttlSeconds: number }> {
  const [incrRow, ttlRow] = await pipeline([["INCR", key], ["TTL", key]]);
  if (incrRow?.error) throw new Error(incrRow.error);
  if (ttlRow?.error) throw new Error(ttlRow.error);

  const count = Number(incrRow?.result || 0);
  let ttl = Number(ttlRow?.result || -1);

  if (ttl < 0) {
    const expireRow = (await pipeline([["EXPIRE", key, windowSeconds]]))[0];
    if (expireRow?.error) throw new Error(expireRow.error);
    ttl = windowSeconds;
  }

  return {
    count,
    ttlSeconds: Math.max(1, ttl),
  };
}
