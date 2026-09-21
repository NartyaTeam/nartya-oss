import { compilePattern, sourceRecipe, type RecipeStore, type Source } from "./source-recipe.mts";

export type Extracted = { ok: true; url: string } | { ok: false; error: string };

const NOT_FOUND = "URL vidéo non trouvée dans le HTML";
const MAX_PACKED_BYTES = 2_000_000;

function found(url: string): Extracted {
  return { ok: true, url };
}

function missing(error = NOT_FOUND): Extracted {
  return { ok: false, error };
}

function firstMatch(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return match[1];
  }
  return null;
}

function parseJwSources(html: string, source: Source): Extracted {
  const url =
    firstMatch(html, [
      /sources:\s*\[\s*\{\s*file:\s*["']([^"']+)["']/,
      /player\.setup\s*\([^)]*sources:\s*\[\s*\{\s*file:\s*["']([^"']+)["']/,
      /playerInstance\s*=\s*player\.setup\s*\([^)]*sources:\s*\[\s*\{\s*file:\s*["']([^"']+)["']/,
    ]) ?? /https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/.exec(html)?.[0];
  if (!url) return missing();

  const raw = url.trim();
  // Some pages reference another host (iframe, ad): the recipe says which stream cannot
  // be the right one here.
  if (compilePattern(source.rejectPattern)?.test(raw)) {
    return missing("Lien ambigu (autre hébergeur référencé dans la page)");
  }
  return found(raw);
}

function parseMetaOg(html: string, source: Source): Extracted {
  const direct = firstMatch(html, [
    /<meta\s+property=["']og:video["']\s+content=["']([^"']+)["']/i,
    /<source[^>]+src=["']([^"']+)["']/i,
    /<video[^>]+src=["']([^"']+)["']/i,
    /var\s+video_source\s*=\s*["']([^"']+)["']/,
  ]);
  const fallback = compilePattern(source.mediaPattern);
  const attribute = /data-video-url=["']([^"']+)["']|data-src=["']([^"']+\.mp4[^"']*)["']/i.exec(
    html,
  );
  const raw = direct ?? fallback?.exec(html)?.[0] ?? attribute?.[1] ?? attribute?.[2];
  if (!raw) return missing();

  const url = raw.trim().replace(/\\/g, "");
  return found(url.startsWith("http") ? url : `https:${url}`);
}

function parsePlayerSrc(html: string, source: Source): Extracted {
  const raw = firstMatch(html, [
    /player\.src\s*\(\s*\[\s*\{\s*src:\s*["']([^"']+)["']/,
    /src:\s*["'](\/[^"']+\.mp4)["']/,
  ]);
  if (!raw) return missing();

  const url = raw.trim();
  if (url.startsWith("http")) return found(url);

  const base = source.mediaBase;
  if (!base) return missing("Base média inconnue pour cette source");
  return found(url.startsWith("/") ? `${base}${url}` : `${base}/${url}`);
}

function parseHlsJson(html: string): Extracted {
  const match = /"hls":"([^"]+)"/.exec(html);
  if (!match?.[1]) return missing("Flux HLS non trouvé (incompatible/privé)");
  return found(match[1].replace(/\\\//g, "/"));
}

// The remote script is never run: only the payload and its dictionary are read, then the
// base-36 tokens are substituted the way the packer would.
export function unpackDeanEdwards(source: string): string | null {
  if (source.length > MAX_PACKED_BYTES) return null;

  const packed =
    /eval\(function\(p,a,c,k,e,(?:d|r)\)\{[\s\S]*?\}\(\s*'((?:\\.|[^'])*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'((?:\\.|[^'])*)'\.split\('\|'\)/.exec(
      source,
    );
  if (!packed?.[1] || !packed[4]) return null;

  const radix = Number(packed[2]);
  const count = Number(packed[3]);
  if (!Number.isInteger(radix) || radix < 2 || radix > 36) return null;
  if (!Number.isInteger(count) || count < 0 || count > 10_000) return null;

  const words = packed[4].split("|");
  let decoded = packed[1];
  for (let index = count - 1; index >= 0; index--) {
    const replacement = words[index];
    if (!replacement) continue;
    const token = index.toString(radix).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    decoded = decoded.replace(new RegExp(`\\b${token}\\b`, "g"), () => replacement);
  }
  return decoded;
}

function decodeEmbeddedText(source: string): string {
  return source
    .replace(/&amp;/gi, "&")
    .replace(/&#x26;/gi, "&")
    .replace(/\\u0026/gi, "&")
    .replace(/\\x26/gi, "&")
    .replace(/\\\//g, "/")
    .replace(/\\(["'\\])/g, "$1");
}

function findEmbeddedMediaUrl(source: string | null): string | null {
  if (!source) return null;
  const text = decodeEmbeddedText(source);
  const file =
    /(?:file|src)\s*:\s*["'](https?:\/\/[^"'\\\s<>]+\.(?:m3u8|mp4)[^"'\\\s<>]*)["']/i.exec(text);
  const generic = /https?:\/\/[^"'\\\s<>]+\.(?:m3u8|mp4)[^"'\\\s<>]*/i.exec(text);
  const raw = file?.[1] ?? generic?.[0];
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function parsePackedJwPlayer(html: string): Extracted {
  const direct = findEmbeddedMediaUrl(html);
  if (direct) return found(direct);

  const packed = findEmbeddedMediaUrl(unpackDeanEdwards(html));
  if (packed) return found(packed);

  return missing("Flux HLS/MP4 non trouvé dans le lecteur");
}

export function createExtractor(store: RecipeStore) {
  function extractFromHtml(html: string, embedUrl: string, sourceKey?: string): Extracted {
    if (!html) return missing("HTML invalide");

    const source = store.getSource(sourceKey ?? store.detectKey(embedUrl));
    if (!source) return missing("Source non reconnue");

    switch (source.strategy) {
      case "jw-sources":
        return parseJwSources(html, source);
      case "meta-og":
        return parseMetaOg(html, source);
      case "player-src":
        return parsePlayerSrc(html, source);
      case "hls-json":
        return parseHlsJson(html);
      case "packed-jw":
        return parsePackedJwPlayer(html);
      default:
        return missing("Stratégie d'extraction inconnue");
    }
  }

  // A host marked exclusive never serves its media for someone else's embed: seeing that
  // happen means a bad html match or a stale cache, not a usable stream.
  function matchesEmbed(embedUrl: string, videoUrl: string): boolean {
    if (!embedUrl || !videoUrl) return false;
    const embedKey = store.detectKey(embedUrl);
    const videoKey = store.detectKey(videoUrl);
    if (!embedKey || !videoKey) return true;
    if (embedKey === videoKey) return true;
    return !store.getSource(videoKey)?.exclusive && !store.getSource(embedKey)?.exclusive;
  }

  return { extractFromHtml, matchesEmbed };
}

export const extractor = createExtractor(sourceRecipe);
