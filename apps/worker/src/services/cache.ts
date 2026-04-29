const API_CACHE_PATTERNS = [
  "devtrend:question-pressure:*",
  "devtrend:cluster:*",
  "devtrend:evidence:*",
  "devtrend:source-status",
] as const;

interface CacheScanClient {
  scan(
    cursor: string,
    matchToken: "MATCH",
    pattern: string,
    countToken: "COUNT",
    count: string,
  ): Promise<[string, string[]]>;
  del(...keys: string[]): Promise<number>;
}

async function scanKeysByPattern(
  cache: CacheScanClient,
  pattern: string,
): Promise<string[]> {
  let cursor = "0";
  const matches: string[] = [];

  do {
    const [nextCursor, keys] = await cache.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      "100",
    );

    matches.push(...keys);
    cursor = nextCursor;
  } while (cursor !== "0");

  return matches;
}

export async function invalidateApiReadCaches(
  cache: CacheScanClient,
): Promise<number> {
  const keys = new Set<string>();

  for (const pattern of API_CACHE_PATTERNS) {
    for (const key of await scanKeysByPattern(cache, pattern)) {
      keys.add(key);
    }
  }

  if (keys.size === 0) {
    return 0;
  }

  return cache.del(...keys);
}
