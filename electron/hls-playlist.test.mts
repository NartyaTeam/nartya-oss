import assert from "node:assert/strict";
import { test } from "node:test";
import { transformPlaylist } from "./hls-playlist.mts";

function counter() {
  const seen: string[] = [];
  const mint = (target: { url: string }) => {
    seen.push(target.url);
    return `h${seen.length}`;
  };
  return { seen, mint };
}

const options = (mint: ReturnType<typeof counter>["mint"]) => ({
  mint,
  provider: "s1",
  tokenSuffix: "&t=abc",
});

test("sends every segment through the proxy with the request token", () => {
  const { seen, mint } = counter();
  const playlist = ["#EXTM3U", "#EXTINF:4,", "seg1.ts", "#EXTINF:4,", "seg2.ts"].join("\n");

  const result = transformPlaylist(
    playlist,
    "https://cdn.test/hls/a.m3u8",
    "/video/proxy",
    options(mint),
  );
  assert.deepEqual(result.split("\n"), [
    "#EXTM3U",
    "#EXTINF:4,",
    "/video/proxy?h=h1&t=abc",
    "#EXTINF:4,",
    "/video/proxy?h=h2&t=abc",
  ]);
  assert.deepEqual(seen, ["https://cdn.test/hls/seg1.ts", "https://cdn.test/hls/seg2.ts"]);
});

test("rewrites the uri attribute of keys, init segments and tracks", () => {
  const { seen, mint } = counter();
  const playlist = [
    '#EXT-X-KEY:METHOD=AES-128,URI="key.bin",IV=0x1',
    '#EXT-X-MAP:URI="init.mp4"',
    '#EXT-X-MEDIA:TYPE=AUDIO,URI="audio/a.m3u8"',
  ].join("\n");

  const result = transformPlaylist(
    playlist,
    "https://cdn.test/hls/a.m3u8",
    "/video/proxy",
    options(mint),
  );
  assert.match(result, /#EXT-X-KEY:METHOD=AES-128,URI="\/video\/proxy\?h=h1&t=abc",IV=0x1/);
  assert.match(result, /#EXT-X-MAP:URI="\/video\/proxy\?h=h2&t=abc"/);
  assert.equal(seen[2], "https://cdn.test/hls/audio/a.m3u8");
});

test("carries the headers the segment will need", () => {
  const targets: unknown[] = [];
  transformPlaylist("seg1.ts", "https://cdn.test/hls/a.m3u8", "/video/proxy", {
    mint: (target) => {
      targets.push(target);
      return "h1";
    },
    provider: "s1",
    referer: "https://one.test/",
    origin: "https://one.test",
  });
  assert.deepEqual(targets[0], {
    url: "https://cdn.test/hls/seg1.ts",
    provider: "s1",
    referer: "https://one.test/",
    origin: "https://one.test",
  });
});

test("leaves alone what it cannot turn into an http url", () => {
  const playlist = ["#EXTM3U", "", "data:text/plain,inline"].join("\n");
  const result = transformPlaylist(playlist, "https://cdn.test/a.m3u8", "/video/proxy", {
    mint: () => "h1",
    provider: null,
  });
  assert.equal(result, playlist);
});

test("keeps the original uri when no handle can be minted", () => {
  const result = transformPlaylist("seg1.ts", "https://cdn.test/hls/a.m3u8", "/video/proxy", {
    mint: () => null,
    provider: null,
  });
  assert.equal(result, "seg1.ts");
});
