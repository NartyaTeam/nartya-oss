import type { Extracted } from "./video-extract.mts";

export type Embed = { url: string; provider: string | null };

export type Unseal = (token: string) => Promise<Embed>;
export type ReadPage = (url: string, provider: string | null) => Promise<string>;
export type Extract = (html: string, embedUrl: string, provider: string | null) => Extracted;
export type Consistent = (embedUrl: string, videoUrl: string) => boolean;
export type Mint = (target: {
  url: string;
  provider: string | null;
  referer: string;
  origin: string;
}) => string | null;

export type Resolved = { handle: string; isHls: boolean };
// A failure past the unsealing names the source, which is what makes a log line useful.
export type Outcome =
  { ok: true; value: Resolved } | { ok: false; error: string; provider?: string | null };

export type ResolveParts = {
  unseal: Unseal;
  readPage: ReadPage;
  extract: Extract;
  consistent: Consistent;
  mint: Mint;
  ttlMs?: number;
  now?: () => number;
};

// Resolving the same token twice within a few minutes is the common case: a rewatch, a
// switch back to a source already tried, a reload after a stall.
const TTL_MS = 5 * 60_000;
const MAX_CACHED = 200;

// No extension survives the proxy url, so the renderer is told which of the two it is
// rather than guessing from a path.
const isHlsUrl = (url: string): boolean => /\.m3u8(\?|$)/i.test(url);

export class StreamError extends Error {}

export function createResolver(parts: ResolveParts) {
  const now = parts.now ?? Date.now;
  const ttlMs = parts.ttlMs ?? TTL_MS;
  const cache = new Map<string, Resolved & { at: number }>();

  function remember(token: string, value: Resolved): void {
    cache.set(token, { ...value, at: now() });
    if (cache.size > MAX_CACHED) {
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
  }

  async function resolve(token: string, forceRefresh = false): Promise<Outcome> {
    if (!token) return { ok: false, error: "Source invalide" };

    if (forceRefresh) cache.delete(token);
    const held = cache.get(token);
    if (held && now() - held.at < ttlMs) {
      return { ok: true, value: { handle: held.handle, isHls: held.isHls } };
    }

    let embed: Embed;
    try {
      embed = await parts.unseal(token);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof StreamError ? error.message : "Source injoignable",
      };
    }
    const failed = (error: string): Outcome => ({ ok: false, error, provider: embed.provider });
    if (!embed.url) return failed("Source introuvable");

    let html: string;
    try {
      html = await parts.readPage(embed.url, embed.provider);
    } catch {
      return failed("Hébergeur injoignable");
    }

    const extracted = parts.extract(html, embed.url, embed.provider);
    if (!extracted.ok) return failed(extracted.error);

    // A host marked exclusive serving someone else's embed means a bad match or a stale
    // cache, never a stream worth playing.
    if (!parts.consistent(embed.url, extracted.url)) {
      return failed("Flux extrait incohérent avec la source");
    }

    const handle = parts.mint({
      url: extracted.url,
      provider: embed.provider,
      // The embed page is what the playlist and its segments are fetched on behalf of.
      referer: embed.url,
      origin: new URL(embed.url).origin,
    });
    if (!handle) return failed("Flux non enregistrable");

    const value = { handle, isHls: isHlsUrl(extracted.url) };
    remember(token, value);
    return { ok: true, value };
  }

  return { resolve, forget: (token: string) => cache.delete(token) };
}
