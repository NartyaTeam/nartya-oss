import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { PassThrough, Readable } from "node:stream";
import { test } from "node:test";
import { createProxy, type Fetch } from "./proxy.mts";
import { createSegmentCache } from "./segment-cache.mts";
import { createHandles } from "./stream-handles.mts";

type Upstream = { body: string; status?: number; headers?: Record<string, string> };

function upstreamOf(answers: Record<string, Upstream>) {
  const asked: { url: string; headers: Record<string, string> }[] = [];
  const fetch = ((url: string, options: { headers: Record<string, string> }) => {
    asked.push({ url, headers: options.headers });
    const answer = answers[url] ?? { body: "", status: 404 };
    return Promise.resolve({
      url,
      status: answer.status ?? 200,
      statusText: "OK",
      headers: {
        "content-length": String(Buffer.byteLength(answer.body)),
        ...answer.headers,
      },
      stream: Readable.from([Buffer.from(answer.body)]),
    });
  }) as unknown as Fetch;
  return { fetch, asked };
}

async function proxyWith(answers: Record<string, Upstream>) {
  const handles = createHandles();
  const cache = createSegmentCache();
  const { fetch, asked } = upstreamOf(answers);
  const proxy = createProxy({
    handles,
    cache,
    fetch,
    detectKey: () => null,
    localFile: () => null,
  });
  await proxy.start();
  return { proxy, handles, cache, asked };
}

async function get(url: string, headers: Record<string, string> = {}, timeoutMs = 5_000) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  return { status: response.status, headers: response.headers, body: await response.text() };
}

test("refuses a request without the right token", async () => {
  const { proxy } = await proxyWith({});
  const base = `http://127.0.0.1:${proxy.port}/video/proxy`;

  assert.equal((await get(base)).status, 403);
  assert.equal((await get(`${base}?t=wrong`)).status, 403);
  assert.equal((await get(`${base}?t=${proxy.token}&h=nope`)).status, 410);
  proxy.stop();
});

test("answers the cors preflight and refuses another method", async () => {
  const { proxy } = await proxyWith({});
  const base = `http://127.0.0.1:${proxy.port}/video/proxy`;

  const preflight = await fetch(base, { method: "OPTIONS" });
  assert.equal(preflight.status, 200);
  assert.equal(preflight.headers.get("access-control-allow-methods"), "GET, OPTIONS");

  assert.equal((await fetch(`${base}?t=${proxy.token}`, { method: "POST" })).status, 405);
  proxy.stop();
});

test("asks for a handle and refuses an unknown route", async () => {
  const { proxy } = await proxyWith({});
  assert.equal(
    (await get(`http://127.0.0.1:${proxy.port}/video/proxy?t=${proxy.token}`)).status,
    400,
  );
  assert.equal((await get(`http://127.0.0.1:${proxy.port}/other?t=${proxy.token}`)).status, 404);
  proxy.stop();
});

test("serves a segment then answers the next one from memory", async () => {
  const url = "https://cdn.test/seg1.ts";
  const { proxy, handles, asked } = await proxyWith({ [url]: { body: "segment-bytes" } });
  const handle = handles.mint({ url });
  const target = `http://127.0.0.1:${proxy.port}/video/proxy?h=${handle}&t=${proxy.token}`;

  const first = await get(target);
  assert.equal(first.body, "segment-bytes");
  assert.equal(first.headers.get("x-proxy-cache"), null);

  const second = await get(target);
  assert.equal(second.body, "segment-bytes");
  assert.equal(second.headers.get("x-proxy-cache"), "HIT");
  assert.equal(asked.length, 1, "the second read never reached the host");
  proxy.stop();
});

test("never caches a segment the host cut short", async () => {
  const url = "https://cdn.test/seg2.ts";
  const { proxy, handles, cache } = await proxyWith({
    [url]: { body: "short", headers: { "content-length": "999" } },
  });
  const handle = handles.mint({ url });

  // The client gives up, exactly as hls.js does on a variant change or a seek.
  await get(
    `http://127.0.0.1:${proxy.port}/video/proxy?h=${handle}&t=${proxy.token}`,
    {},
    300,
  ).catch(() => null);
  assert.equal(cache.get(url), null);
  proxy.stop();
});

test("sends every playlist line back through itself, token included", async () => {
  const url = "https://cdn.test/hls/a.m3u8";
  const { proxy, handles } = await proxyWith({
    [url]: {
      body: "#EXTM3U\n#EXTINF:4,\nseg1.ts\n",
      headers: { "content-type": "application/vnd.apple.mpegurl" },
    },
  });
  const handle = handles.mint({ url });

  const result = await get(
    `http://127.0.0.1:${proxy.port}/video/proxy?h=${handle}&t=${proxy.token}`,
  );
  assert.equal(result.headers.get("content-type"), "application/vnd.apple.mpegurl");
  const segment = result.body.trim().split("\n").at(-1) ?? "";
  assert.match(segment, new RegExp(`^http://127\\.0\\.0\\.1:${proxy.port}/video/proxy\\?h=.+&t=`));

  // The line has to resolve back to the absolute segment url.
  const rewritten = new URL(segment);
  assert.equal(
    handles.resolve(rewritten.searchParams.get("h"))?.url,
    "https://cdn.test/hls/seg1.ts",
  );
  proxy.stop();
});

test("rebuilds the range a host ignored", async () => {
  const url = "https://cdn.test/movie.mp4";
  const { proxy, handles } = await proxyWith({ [url]: { body: "0123456789" } });
  const handle = handles.mint({ url });

  const result = await get(
    `http://127.0.0.1:${proxy.port}/video/proxy?h=${handle}&t=${proxy.token}`,
    {
      Range: "bytes=2-5",
    },
  );
  assert.equal(result.status, 206);
  assert.equal(result.headers.get("content-range"), "bytes 2-5/10");
  assert.equal(result.body, "2345");
  proxy.stop();
});

test("passes a host error through with its status", async () => {
  const url = "https://cdn.test/gone.mp4";
  const { proxy, handles } = await proxyWith({ [url]: { body: "", status: 403 } });
  const handle = handles.mint({ url });

  const result = await get(
    `http://127.0.0.1:${proxy.port}/video/proxy?h=${handle}&t=${proxy.token}`,
  );
  assert.equal(result.status, 403);
  assert.match(result.body, /Erreur HTTP 403/);
  proxy.stop();
});

test("hands out a playback url only once it is listening", async () => {
  const { proxy } = await proxyWith({});
  assert.match(proxy.playbackUrl("abc", true) ?? "", /\/video\/proxy\?h=abc&kind=hls&t=/);
  proxy.stop();
  assert.equal(proxy.playbackUrl("abc", true), null);
});

test("answers when a playlist stream dies instead of hanging", async () => {
  const url = "https://cdn.test/hls/dead.m3u8";
  const handles = createHandles();
  const proxy = createProxy({
    handles,
    cache: createSegmentCache(),
    detectKey: () => null,
    localFile: () => null,
    fetch: (() =>
      Promise.resolve({
        url,
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/vnd.apple.mpegurl" },
        stream: new Readable({
          read() {
            this.destroy(new Error("cdn dropped mid playlist"));
          },
        }),
      })) as unknown as Fetch,
  });
  await proxy.start();
  const handle = handles.mint({ url });

  const result = await get(
    `http://127.0.0.1:${proxy.port}/video/proxy?h=${handle}&t=${proxy.token}`,
  );
  assert.equal(result.status, 500);
  proxy.stop();
});

test("stops pulling the host when the player walks away mid segment", async () => {
  const url = "https://cdn.test/long.ts";
  const upstream = new PassThrough();
  const handles = createHandles();
  const cache = createSegmentCache();
  const proxy = createProxy({
    handles,
    cache,
    detectKey: () => null,
    localFile: () => null,
    fetch: (() =>
      Promise.resolve({
        url,
        status: 200,
        statusText: "OK",
        headers: { "content-length": "9999999", "content-type": "video/mp2t" },
        stream: upstream,
      })) as unknown as Fetch,
  });
  await proxy.start();
  const handle = handles.mint({ url });

  await new Promise<void>((done) => {
    const client = http.get(
      `http://127.0.0.1:${proxy.port}/video/proxy?h=${handle}&t=${proxy.token}`,
      (incoming) => {
        incoming.once("data", () => {
          // The player seeks or switches variant: it drops the request mid segment.
          client.destroy();
          done();
        });
      },
    );
    upstream.write(Buffer.alloc(64 * 1024));
  });

  await once(upstream, "close");
  assert.equal(upstream.destroyed, true, "the cdn download outlived the player");
  assert.equal(cache.get(url), null, "a partial segment must never be cached");
  proxy.stop();
});
