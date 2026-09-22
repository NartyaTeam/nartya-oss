import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { Fetch } from "./proxy.mts";
import { createProxy } from "./proxy.mts";
import { createSegmentCache } from "./segment-cache.mts";
import { createHandles } from "./stream-handles.mts";

async function get(url: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(5_000) });
  return { status: response.status, headers: response.headers, body: await response.text() };
}

async function proxyWith() {
  const proxy = createProxy({
    handles: createHandles(),
    cache: createSegmentCache(),
    detectKey: () => null,
    fetch: (() => Promise.reject(new Error("no network"))) as unknown as Fetch,
    localFile: () => null,
  });
  await proxy.start();
  return { proxy };
}

test("serves a downloaded file, with ranges and without the network", async () => {
  const folder = mkdtempSync(join(tmpdir(), "nartya-local-"));
  writeFileSync(join(folder, "video.mp4"), "0123456789");
  const proxy = createProxy({
    handles: createHandles(),
    cache: createSegmentCache(),
    detectKey: () => null,
    fetch: (() => Promise.reject(new Error("the network must not be touched"))) as unknown as Fetch,
    localFile: (_id, rel) => join(folder, rel),
  });
  await proxy.start();
  const base = `http://127.0.0.1:${proxy.port}/local?id=a&t=${proxy.token}`;

  const whole = await get(base);
  assert.equal(whole.body, "0123456789");
  assert.equal(whole.headers.get("content-type"), "video/mp4");

  const part = await get(base, { Range: "bytes=2-5" });
  assert.equal(part.status, 206);
  assert.equal(part.body, "2345");
  assert.equal(part.headers.get("content-range"), "bytes 2-5/10");
  proxy.stop();
});

test("turns a downloaded playlist into local urls carrying the token", async () => {
  const folder = mkdtempSync(join(tmpdir(), "nartya-local-"));
  writeFileSync(join(folder, "playlist.m3u8"), "#EXTM3U\n#EXTINF:4,\nseg00000.ts\n");
  const proxy = createProxy({
    handles: createHandles(),
    cache: createSegmentCache(),
    detectKey: () => null,
    fetch: (() => Promise.reject(new Error("no network"))) as unknown as Fetch,
    localFile: (_id, rel) => join(folder, rel),
  });
  await proxy.start();

  const result = await get(
    `http://127.0.0.1:${proxy.port}/local?id=a&path=playlist.m3u8&t=${proxy.token}`,
  );
  const line = result.body.trim().split("\n").at(-1) ?? "";
  assert.match(line, /\/local\?id=a&path=seg00000\.ts&t=/);
  proxy.stop();
});

test("answers 404 rather than reaching outside the entry", async () => {
  const proxy = createProxy({
    handles: createHandles(),
    cache: createSegmentCache(),
    detectKey: () => null,
    fetch: (() => Promise.reject(new Error("no network"))) as unknown as Fetch,
    // What resolveLocalFile does for a path that escapes the folder.
    localFile: () => null,
  });
  await proxy.start();

  const result = await get(
    `http://127.0.0.1:${proxy.port}/local?id=a&path=../../secret&t=${proxy.token}`,
  );
  assert.equal(result.status, 404);
  proxy.stop();
});

test("opens a lan listener that answers its own token and not the loopback one", async () => {
  const { proxy } = await proxyWith();
  const castPort = await proxy.startCast();
  assert.ok(castPort && castPort !== proxy.port);

  const playback = proxy.playbackUrl("abc", false) ?? "";
  const casted = await proxy.castUrl(playback, "127.0.0.1");
  assert.ok(casted, "a playback url translates");

  const url = new URL(casted ?? "");
  assert.equal(url.port, String(castPort));
  const lanToken = url.searchParams.get("t") ?? "";
  assert.notEqual(lanToken, proxy.token, "the lan token is its own");

  // The loopback token must not open the lan listener.
  const refused = await get(`http://127.0.0.1:${castPort}/video/proxy?h=abc&t=${proxy.token}`);
  assert.equal(refused.status, 403);
  const accepted = await get(`http://127.0.0.1:${castPort}/video/proxy?h=abc&t=${lanToken}`);
  assert.equal(accepted.status, 410, "reaches the handler, then fails on the unknown handle");

  proxy.stop();
});

test("remembers which devices came to the lan listener, and forgets on close", async () => {
  const { proxy } = await proxyWith();
  const castPort = await proxy.startCast();
  assert.equal(proxy.lastCastRequestFrom("127.0.0.1"), 0);

  const asked = Date.now();
  await get(`http://127.0.0.1:${castPort}/video/proxy?h=abc&t=nope`);
  // A refused request still proves the device reached this machine, which is the question.
  assert.ok(proxy.lastCastRequestFrom("127.0.0.1") >= asked);
  assert.equal(proxy.lastCastRequestFrom("192.168.1.42"), 0);

  proxy.stopCast();
  assert.equal(proxy.lastCastRequestFrom("127.0.0.1"), 0);
  proxy.stop();
});

test("closing the cast session takes its token with it", async () => {
  const { proxy } = await proxyWith();
  const castPort = await proxy.startCast();
  proxy.stopCast();

  assert.equal(proxy.castPort, null);
  await assert.rejects(get(`http://127.0.0.1:${castPort}/video/proxy?t=x`));
  proxy.stop();
});

test("two cast sessions starting at once open one listener", async () => {
  const { proxy } = await proxyWith();
  const [first, second] = await Promise.all([proxy.startCast(), proxy.startCast()]);

  assert.equal(first, second, "a second listener would leak a port and a token");
  assert.equal(proxy.castPort, first);
  proxy.stop();
});
