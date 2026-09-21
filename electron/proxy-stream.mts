import type http from "node:http";
import { parseByteRange, sliceUpstream } from "./byte-range.mts";
import { createLogger } from "./log.mts";
import type { ProviderResponse } from "./provider-fetch.mts";
import { pipeWithReadAhead, type Source } from "./read-ahead.mts";
import { isSegmentUrl, MAX_CACHEABLE_BYTES, type SegmentCache } from "./segment-cache.mts";

const log = createLogger("proxy-stream");
const READ_AHEAD_BYTES = 24 * 1024 * 1024;

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
};

export function fail(response: http.ServerResponse, status: number, error: string): void {
  if (response.headersSent) return;
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ success: false, error }));
}

export async function readText(stream: NodeJS.ReadableStream): Promise<string> {
  let text = "";
  for await (const chunk of stream) text += String(chunk);
  return text;
}

export function isPlaylist(url: string, contentType: string): boolean {
  if (contentType.includes("application/vnd.apple.mpegurl")) return true;
  if (contentType.toLowerCase().includes("application/x-mpegurl")) return true;
  return url.includes(".m3u8");
}

export function serveCached(
  response: http.ServerResponse,
  segment: { body: Buffer; contentType: string },
): void {
  response.writeHead(200, {
    ...CORS,
    "Content-Type": segment.contentType,
    "Content-Length": String(segment.body.length),
    "Cache-Control": "public, max-age=3600, immutable",
    "X-Proxy-Cache": "HIT",
  });
  response.end(segment.body);
}

export async function serveSegment(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  upstream: ProviderResponse,
  contentType: string,
  cache: SegmentCache,
): Promise<void> {
  const announced = upstream.headers["content-length"];
  const expected = announced === undefined ? null : Number(announced);
  response.writeHead(200, {
    ...CORS,
    "Content-Type": contentType || "video/mp2t",
    ...(announced ? { "Content-Length": announced } : {}),
    "Cache-Control": "public, max-age=3600, immutable",
  });

  const chunks: Buffer[] = [];
  let kept = 0;
  let received = 0;
  let cacheable = true;

  try {
    for await (const chunk of upstream.stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
      received += buffer.length;
      if (!response.write(buffer)) await new Promise((drain) => response.once("drain", drain));
      if (!cacheable) continue;

      kept += buffer.length;
      if (kept > MAX_CACHEABLE_BYTES) {
        cacheable = false;
        chunks.length = 0;
      } else {
        chunks.push(buffer);
      }
    }
    response.end();
  } catch (error) {
    log.warn("segment stream interrupted", { err: error });
    response.destroy(error instanceof Error ? error : undefined);
    return;
  }

  // Never cache a partial segment. hls.js abandons requests all the time (variant
  // change, seek, bitrate arbitration) and the iteration above ends without throwing.
  const complete = expected !== null && received === expected && !request.destroyed;
  if (cacheable && complete && chunks.length > 0) {
    cache.put(upstream.url, Buffer.concat(chunks), contentType);
  } else if (cacheable && !complete) {
    log.debug("segment not cached, incomplete", {
      received,
      expected,
      clientGone: request.destroyed,
    });
  }
}

export async function serveStream(
  response: http.ServerResponse,
  upstream: ProviderResponse,
  rangeHeader: string | undefined,
  contentType: string,
  provider: string | null,
): Promise<void> {
  for (const [name, value] of Object.entries(CORS)) response.setHeader(name, value);
  if (contentType) response.setHeader("Content-Type", contentType);
  if (isSegmentUrl(upstream.url) || contentType.includes("video/")) {
    response.setHeader("Cache-Control", "public, max-age=3600, immutable");
  }

  let body: Source = upstream.stream;
  const length = upstream.headers["content-length"];

  if (rangeHeader && upstream.status === 206) {
    response.statusCode = 206;
    const contentRange = upstream.headers["content-range"];
    if (contentRange) response.setHeader("Content-Range", contentRange);
    if (length) response.setHeader("Content-Length", length);
    response.setHeader("Accept-Ranges", "bytes");
  } else if (rangeHeader && upstream.status === 200) {
    // The host ignored the range and sent the whole file: rebuild it here, otherwise
    // the player restarts from the beginning on every seek.
    const total = Number(length);
    const wanted = parseByteRange(rangeHeader, total);
    if (wanted) {
      body = sliceUpstream(upstream.stream, wanted.start, wanted.end);
      response.statusCode = 206;
      response.setHeader("Content-Range", `bytes ${wanted.start}-${wanted.end}/${total}`);
      response.setHeader("Content-Length", String(wanted.end - wanted.start + 1));
      response.setHeader("Accept-Ranges", "bytes");
      if (wanted.start > 0) {
        log.warn("range ignored by the host", { provider, discarded: wanted.start });
      }
    } else {
      // Nothing to slice on: saying so beats lying with a 206.
      if (length) response.setHeader("Content-Length", length);
      response.setHeader("Accept-Ranges", "none");
    }
  } else {
    if (length) response.setHeader("Content-Length", length);
    response.setHeader("Accept-Ranges", "bytes");
  }

  try {
    await pipeWithReadAhead(body, response, READ_AHEAD_BYTES);
  } catch (error) {
    log.warn("stream interrupted", { err: error });
    if (!response.headersSent) fail(response, 502, "Flux interrompu");
    else response.destroy(error instanceof Error ? error : undefined);
  }
}
