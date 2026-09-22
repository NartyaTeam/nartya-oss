export type Variant = { uri: string; bandwidth: number; height: number };
export type Segment = { url: string; name: string };

export type LocalPlan = {
  segments: Segment[];
  keyUrl: string | null;
  mapUrl: string | null;
  playlist: string;
};

export const KEY_FILE = "key.bin";
export const MAP_FILE = "init.mp4";
export const PLAYLIST_FILE = "playlist.m3u8";

export function resolveUri(uri: string, baseUrl: string): string {
  try {
    return new URL(uri, baseUrl).toString();
  } catch {
    return uri;
  }
}

export function attributeUri(line: string): string | null {
  return /URI="([^"]+)"/.exec(line)?.[1] ?? null;
}

export function segmentExtension(uri: string): string {
  const path = (uri.split("?")[0] ?? "").toLowerCase();
  if (path.endsWith(".m4s")) return ".m4s";
  if (path.endsWith(".mp4")) return ".mp4";
  if (path.endsWith(".aac")) return ".aac";
  return ".ts";
}

export function isMaster(text: string): boolean {
  return /#EXT-X-STREAM-INF/i.test(text);
}

export function readVariants(masterText: string, baseUrl: string): Variant[] {
  const lines = masterText.split(/\r?\n/);
  const variants: Variant[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
    const bandwidth = Number(/BANDWIDTH=(\d+)/.exec(line)?.[1] ?? 0);
    const height = Number(/RESOLUTION=\d+x(\d+)/i.exec(line)?.[1] ?? 0);

    let next = index + 1;
    while (next < lines.length && (lines[next]?.trim() === "" || lines[next]?.startsWith("#"))) {
      next++;
    }
    const uri = lines[next]?.trim();
    if (uri) variants.push({ uri: resolveUri(uri, baseUrl), bandwidth, height });
  }
  return variants;
}

export function pickVariant(variants: Variant[], maxHeight = Infinity): Variant | null {
  if (variants.length === 0) return null;
  const highest = (list: Variant[]) => list.reduce((a, b) => (b.bandwidth > a.bandwidth ? b : a));
  if (!Number.isFinite(maxHeight)) return highest(variants);

  const underCap = variants.filter((variant) => variant.height && variant.height <= maxHeight);
  if (underCap.length > 0) return highest(underCap);

  // Nothing fits: the smallest known resolution is the closest to what was asked.
  const known = variants.filter((variant) => variant.height);
  if (known.length > 0) return known.reduce((a, b) => (b.height < a.height ? b : a));
  return variants.reduce((a, b) => (b.bandwidth < a.bandwidth ? b : a));
}

// Rewrites the media playlist so every uri is a local file name. ffmpeg and hls.js both
// read it as is, which is what lets the download play with no network at all.
export function planLocalPlaylist(text: string, baseUrl: string): LocalPlan {
  const segments: Segment[] = [];
  const out: string[] = [];
  let keyUrl: string | null = null;
  let mapUrl: string | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();

    if (line.startsWith("#EXT-X-KEY")) {
      const uri = attributeUri(line);
      if (uri && !/METHOD=NONE/i.test(line)) {
        keyUrl = resolveUri(uri, baseUrl);
        out.push(raw.replace(/URI="[^"]+"/, `URI="${KEY_FILE}"`));
      } else {
        out.push(raw);
      }
      continue;
    }

    if (line.startsWith("#EXT-X-MAP")) {
      const uri = attributeUri(line);
      if (uri) {
        mapUrl = resolveUri(uri, baseUrl);
        out.push(raw.replace(/URI="[^"]+"/, `URI="${MAP_FILE}"`));
      } else {
        out.push(raw);
      }
      continue;
    }

    if (line === "" || line.startsWith("#")) {
      out.push(raw);
      continue;
    }

    const name = `seg${String(segments.length).padStart(5, "0")}${segmentExtension(line)}`;
    segments.push({ url: resolveUri(line, baseUrl), name });
    out.push(name);
  }

  return { segments, keyUrl, mapUrl, playlist: out.join("\n") };
}
