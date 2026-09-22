import crypto from "node:crypto";
import http from "node:http";
import { transformPlaylist } from "./hls-playlist.mts";
import { toCastUrl } from "./cast-url.mts";
import { createLogger } from "./log.mts";
import { fetchUrl, type ProviderResponse } from "./provider-fetch.mts";
import { buildProviderRequest } from "./provider-request.mts";
import {
  CORS,
  fail,
  isPlaylist,
  readText,
  rewriteLocalPlaylist,
  serveCached,
  serveLocalFile,
  serveSegment,
  serveStream,
} from "./proxy-stream.mts";
import { isSegmentUrl, segmentCache, type SegmentCache } from "./segment-cache.mts";
import { createSignedUrls, SIGNED_URL_TIMEOUT_MS } from "./signed-url.mts";
import { sourceRecipe } from "./source-recipe.mts";
import { streamHandles, type Handles, type Target } from "./stream-handles.mts";

export type Fetch = typeof fetchUrl;

export type LocalFile = (id: string, rel: string) => string | null;

export type ProxyParts = {
  handles: Handles;
  cache: SegmentCache;
  fetch: Fetch;
  detectKey: (url: string) => string | null;
  localFile: LocalFile;
};

const log = createLogger("proxy");

function sameToken(given: string | null, expected: string | null): boolean {
  if (!expected || given === null) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createProxy(parts: ProxyParts) {
  const { handles, cache, fetch, detectKey, localFile } = parts;
  const signedUrlFor = createSignedUrls((url, options) =>
    fetch(url, { ...options, timeoutMs: SIGNED_URL_TIMEOUT_MS }),
  );

  let server: http.Server | null = null;
  let port: number | null = null;
  let token: string | null = null;
  // A second listener, open on the local network only while casting: the television
  // fetches the video itself, with the per host headers added here.
  let castServer: http.Server | null = null;
  let castPort: number | null = null;
  let castToken: string | null = null;

  // Trusted only when the Host port is one of ours: a forged Host would otherwise poison
  // the segment urls we hand back.
  function publicOrigin(request: http.IncomingMessage): string {
    const host = request.headers.host;
    const asked = Number(host?.split(":").pop());
    if (host && (asked === port || (castPort !== null && asked === castPort))) {
      return `http://${host}`;
    }
    return `http://127.0.0.1:${port}`;
  }

  async function proxy(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    url: URL,
  ): Promise<void> {
    const handle = url.searchParams.get("h");
    const target = handle ? handles.resolve(handle) : null;
    if (!target) {
      // Handle evicted or session restarted: the player has to resolve the stream again.
      fail(response, handle ? 410 : 400, "Lien de lecture expiré");
      return;
    }

    const provider =
      (target.provider !== "unknown" ? target.provider : null) ?? detectKey(target.url);
    const rangeHeader = request.headers.range;

    if (!rangeHeader && isSegmentUrl(target.url)) {
      const cached = cache.get(target.url);
      if (cached) {
        serveCached(response, cached);
        return;
      }
    }

    const built = buildProviderRequest(target.url, provider, rangeHeader);
    const headers = { ...built.headers };
    if (target.referer) headers.Referer = target.referer;
    if (target.origin) headers.Origin = target.origin;

    let upstream = await fetch(built.url, { headers, timeoutMs: built.timeoutMs });

    if (rangeHeader && upstream.status === 200) {
      upstream = (await retryOnSignedUrl(built.url, headers, upstream)) ?? upstream;
    }

    if (upstream.status < 200 || upstream.status >= 300) {
      log.warn("host refused", { status: upstream.status, provider, handle });
      upstream.stream.destroy();
      fail(response, upstream.status, `Erreur HTTP ${upstream.status}: ${upstream.statusText}`);
      return;
    }

    const contentType = String(upstream.headers["content-type"] ?? "");
    if (isPlaylist(built.url, contentType)) {
      await servePlaylist(request, response, upstream, url, provider, target);
      return;
    }
    if (!rangeHeader && isSegmentUrl(built.url)) {
      await serveSegment(request, response, upstream, contentType, cache);
      return;
    }
    await serveStream(response, upstream, rangeHeader, contentType, provider);
  }

  async function retryOnSignedUrl(
    url: string,
    headers: Record<string, string>,
    current: ProviderResponse,
  ): Promise<ProviderResponse | null> {
    const signed = await signedUrlFor(url, headers);
    if (!signed || signed === url) return null;

    try {
      const retry = await fetch(signed, { headers });
      if (retry.status !== 206) {
        retry.stream.destroy();
        return null;
      }
      // Three gigabytes nobody will read: cut it straight away.
      current.stream.destroy();
      return retry;
    } catch (error) {
      log.warn("range on the signed url failed", { url, err: error });
      return null;
    }
  }

  async function servePlaylist(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    upstream: ProviderResponse,
    url: URL,
    provider: string | null,
    target: Target,
  ): Promise<void> {
    const content = await readText(upstream.stream);
    const rewritten = transformPlaylist(
      content,
      upstream.url,
      `${publicOrigin(request)}/video/proxy`,
      {
        mint: handles.mint,
        provider,
        referer: target.referer,
        origin: target.origin,
        tokenSuffix: `&t=${encodeURIComponent(url.searchParams.get("t") ?? "")}`,
      },
    );
    response.writeHead(200, { ...CORS, "Content-Type": "application/vnd.apple.mpegurl" });
    response.end(rewritten);
  }

  // Downloaded files, played with no network at all. The path is checked against the
  // entry folder, so a crafted one cannot reach outside it.
  async function local(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    url: URL,
  ): Promise<void> {
    const id = url.searchParams.get("id") ?? "";
    const rel = url.searchParams.get("path") || "video.mp4";
    const file = localFile(id, rel);
    if (!file) {
      fail(response, 404, "Fichier introuvable");
      return;
    }

    const token = encodeURIComponent(url.searchParams.get("t") ?? "");
    const rewrite = rel.endsWith(".m3u8")
      ? (content: string) => rewriteLocalPlaylist(content, id, publicOrigin(request), `&t=${token}`)
      : null;
    await serveLocalFile(request, response, file, rewrite);
  }

  async function handle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    onLan = false,
  ): Promise<void> {
    for (const [name, value] of Object.entries(CORS)) response.setHeader(name, value);
    response.setHeader("Access-Control-Max-Age", "86400");

    if (request.method === "OPTIONS") {
      response.writeHead(200, { "Content-Length": "0" });
      response.end();
      return;
    }
    if (request.method !== "GET") {
      response.writeHead(405);
      response.end("Method Not Allowed");
      return;
    }

    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    // Without a token any page open in a browser on this machine could use the proxy,
    // which answers with Allow-Origin *. On the lan listener, anyone on the network could.
    const expected = onLan ? castToken : token;
    if (!sameToken(url.searchParams.get("t"), expected)) {
      fail(response, 403, "Jeton invalide");
      return;
    }
    if (url.pathname !== "/video/proxy" && url.pathname !== "/local") {
      fail(response, 404, "Route inconnue");
      return;
    }

    try {
      if (url.pathname === "/local") await local(request, response, url);
      else await proxy(request, response, url);
    } catch (error) {
      const isBlocked = (error as NodeJS.ErrnoException).code === "URL_BLOCKED";
      log.warn("request failed", { err: error, blocked: isBlocked });
      fail(
        response,
        isBlocked ? 403 : 500,
        isBlocked ? "Lien de lecture refusé" : "Erreur interne",
      );
    }
  }

  async function start(): Promise<number> {
    if (port !== null) return port;
    token = crypto.randomBytes(24).toString("base64url");
    const listener = http.createServer((request, response) => void handle(request, response));

    return new Promise((resolve, reject) => {
      listener.on("error", reject);
      listener.listen(0, "127.0.0.1", () => {
        const address = listener.address();
        port = typeof address === "object" && address ? address.port : null;
        server = listener;
        log.info("listening", { port });
        resolve(port ?? 0);
      });
    });
  }

  // Opened only while casting, and closed with its token when the session ends.
  async function startCast(): Promise<number | null> {
    if (castPort !== null) return castPort;
    castToken = crypto.randomBytes(24).toString("base64url");
    const listener = http.createServer((request, response) => void handle(request, response, true));

    return new Promise((resolve, reject) => {
      listener.on("error", reject);
      listener.listen(0, "0.0.0.0", () => {
        const address = listener.address();
        castPort = typeof address === "object" && address ? address.port : null;
        castServer = listener;
        log.info("cast listener open", { port: castPort });
        resolve(castPort);
      });
    });
  }

  function stopCast(): void {
    if (!castServer) return;
    castServer.close();
    castServer = null;
    castPort = null;
    castToken = null;
    log.info("cast listener closed");
  }

  async function castUrl(localUrl: string, deviceIp: string): Promise<string | null> {
    if (port === null || token === null) return null;
    await startCast();
    if (castPort === null || castToken === null) return null;
    return toCastUrl(localUrl, { port, token, castPort, castToken, deviceIp });
  }

  function stop(): void {
    stopCast();
    if (!server) return;
    server.close();
    server = null;
    port = null;
    token = null;
    log.info("stopped");
  }

  function localFileUrl(id: string, rel = "video.mp4"): string | null {
    if (port === null || token === null || !id) return null;
    const params = new URLSearchParams({ id, path: rel, t: token });
    return `http://127.0.0.1:${port}/local?${params.toString()}`;
  }

  function playbackUrl(handleId: string, isHls: boolean): string | null {
    if (port === null || token === null) return null;
    const kind = isHls ? "&kind=hls" : "";
    return `http://127.0.0.1:${port}/video/proxy?h=${handleId}${kind}&t=${token}`;
  }

  return {
    start,
    stop,
    startCast,
    stopCast,
    castUrl,
    playbackUrl,
    localFileUrl,
    handle,
    get port() {
      return port;
    },
    get token() {
      return token;
    },
    get castPort() {
      return castPort;
    },
  };
}

export const localProxy = createProxy({
  handles: streamHandles,
  cache: segmentCache,
  fetch: fetchUrl,
  detectKey: (url) => sourceRecipe.detectKey(url),
  // Downloads are not wired to a window yet, so nothing local can be served. Replaced
  // when the downloads page arrives and the manager knows its root.
  localFile: () => null,
});
