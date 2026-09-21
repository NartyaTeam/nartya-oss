import type { Readable } from "node:stream";
import { createLogger } from "./log.mts";

export type Probe = (
  url: string,
  options: { method: "GET" | "HEAD"; headers: Record<string, string> },
) => Promise<{ url: string; stream: Readable }>;

const log = createLogger("signed-url");
const TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 32;
const PROBE_TIMEOUT_MS = 15_000;

// Some hosts answer the first request on a signed url with 200, ignoring Range, so every
// seek landed on a fresh token: resolve the chain once and spend that first call here.
export function createSignedUrls(probe: Probe, ttlMs = TTL_MS, now = Date.now) {
  const cache = new Map<string, { url: string; at: number }>();

  return async function resolve(
    original: string,
    headers: Record<string, string>,
  ): Promise<string | null> {
    const cached = cache.get(original);
    if (cached && now() - cached.at < ttlMs) return cached.url;

    let signed: string;
    try {
      const head = await probe(original, { method: "HEAD", headers });
      head.stream.destroy();
      if (!head.url || head.url === original) return null;
      signed = head.url;

      const primer = await probe(signed, {
        method: "GET",
        headers: { ...headers, Range: "bytes=0-1" },
      });
      primer.stream.destroy();
    } catch (error) {
      log.warn("resolution failed", { url: original, err: error });
      return null;
    }

    cache.set(original, { url: signed, at: now() });
    if (cache.size > MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return signed;
  };
}

export const SIGNED_URL_TIMEOUT_MS = PROBE_TIMEOUT_MS;
