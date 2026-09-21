export type Segment = { body: Buffer; contentType: string };

const MAX_BYTES = 80 * 1024 * 1024;
const MAX_SEGMENT_BYTES = 6 * 1024 * 1024;
// Segments are immutable: same url, same bytes. The cache only saves a cdn round trip
// on a seek or a retry, and is dropped when the app restarts.
const TTL_MS = 60 * 60_000;

export function isSegmentUrl(url: string): boolean {
  const path = (url.split("?")[0] ?? "").toLowerCase();
  if (path.endsWith(".ts") || path.endsWith(".m4s") || path.endsWith(".aac")) return true;
  return path.endsWith(".mp4") && !path.includes("/embed") && !path.includes("shell.php");
}

export function createSegmentCache(maxBytes = MAX_BYTES, ttlMs = TTL_MS, now = Date.now) {
  const entries = new Map<string, Segment & { at: number }>();
  let used = 0;

  function drop(url: string): void {
    const entry = entries.get(url);
    if (!entry) return;
    used -= entry.body.length;
    entries.delete(url);
  }

  function get(url: string): Segment | null {
    const entry = entries.get(url);
    if (!entry) return null;
    if (now() - entry.at > ttlMs) {
      drop(url);
      return null;
    }
    // Re-inserted so the map order stays least recently used first.
    entries.delete(url);
    entries.set(url, entry);
    return { body: entry.body, contentType: entry.contentType };
  }

  function put(url: string, body: Buffer, contentType: string): void {
    if (body.length > MAX_SEGMENT_BYTES) return;
    drop(url);
    while (used + body.length > maxBytes && entries.size > 0) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      drop(oldest);
    }
    entries.set(url, { body, contentType: contentType || "video/mp2t", at: now() });
    used += body.length;
  }

  return {
    get,
    put,
    get bytes() {
      return used;
    },
    get size() {
      return entries.size;
    },
  };
}

export type SegmentCache = ReturnType<typeof createSegmentCache>;

export const segmentCache = createSegmentCache();
export const MAX_CACHEABLE_BYTES = MAX_SEGMENT_BYTES;
