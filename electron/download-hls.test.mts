import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { test } from "node:test";
import { downloadHls } from "./download-hls.mts";
import type { Fetch } from "./download-file.mts";

const master = [
  "#EXTM3U",
  "#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360",
  "360.m3u8",
  "#EXT-X-STREAM-INF:BANDWIDTH=6000000,RESOLUTION=1920x1080",
  "1080.m3u8",
].join("\n");

const media = (name: string) =>
  [
    "#EXTM3U",
    '#EXT-X-KEY:METHOD=AES-128,URI="key"',
    "#EXTINF:4,",
    `${name}-a.ts`,
    "#EXTINF:4,",
    `${name}-b.ts`,
  ].join("\n");

function serving(): { fetch: Fetch; asked: string[] } {
  const asked: string[] = [];
  const fetch = ((url: string) => {
    asked.push(url);
    const path = new URL(url).pathname;
    const body = path.endsWith("master.m3u8")
      ? master
      : path.endsWith("360.m3u8")
        ? media("low")
        : path.endsWith("1080.m3u8")
          ? media("high")
          : "bytes";
    return Promise.resolve({
      url,
      status: 200,
      statusText: "OK",
      headers: { "content-length": String(body.length) },
      stream: Readable.from([Buffer.from(body)]),
    });
  }) as unknown as Fetch;
  return { fetch, asked };
}

function job(dir: string, maxHeight: number) {
  return {
    url: "https://cdn.test/hls/master.m3u8",
    provider: null,
    dir,
    maxHeight,
    signal: new AbortController().signal,
    onProgress: () => {},
  };
}

test("downloads the variant the quality setting asks for", async () => {
  const dir = mkdtempSync(join(tmpdir(), "nartya-hls-"));
  const { fetch, asked } = serving();

  const result = await downloadHls(fetch, job(dir, 360), null);
  assert.ok(asked.some((url) => url.endsWith("360.m3u8")));
  assert.equal(
    asked.some((url) => url.endsWith("1080.m3u8")),
    false,
  );
  assert.equal(result.file, "playlist.m3u8");
});

test("writes a playlist that points at local files only", async () => {
  const dir = mkdtempSync(join(tmpdir(), "nartya-hls-"));
  await downloadHls(serving().fetch, job(dir, Infinity), null);

  const playlist = readFileSync(join(dir, "playlist.m3u8"), "utf8");
  assert.equal(/https?:\/\//.test(playlist), false, "no remote url survives");
  assert.match(playlist, /URI="key.bin"/);
  assert.match(playlist, /^seg00000\.ts$/m);
  assert.ok(existsSync(join(dir, "seg00000.ts")));
  assert.ok(existsSync(join(dir, "seg00001.ts")));
  assert.ok(existsSync(join(dir, "key.bin")), "the aes key comes down too");
});

test("keeps the segments when there is no ffmpeg to merge them", async () => {
  const dir = mkdtempSync(join(tmpdir(), "nartya-hls-"));
  const result = await downloadHls(serving().fetch, job(dir, Infinity), null);

  assert.equal(result.file, "playlist.m3u8");
  assert.ok(result.sizeBytes > 0);
  assert.ok(existsSync(join(dir, "seg00000.ts")), "still playable through hls.js");
});

test("refuses a playlist with nothing to download", async () => {
  const dir = mkdtempSync(join(tmpdir(), "nartya-hls-"));
  const fetch = (() =>
    Promise.resolve({
      url: "https://cdn.test/hls/master.m3u8",
      status: 200,
      statusText: "OK",
      headers: {},
      stream: Readable.from([Buffer.from("#EXTM3U\n")]),
    })) as unknown as Fetch;

  await assert.rejects(downloadHls(fetch, job(dir, Infinity), null), /sans segment/);
});
