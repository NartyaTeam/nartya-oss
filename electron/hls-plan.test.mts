import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isMaster,
  pickVariant,
  planLocalPlaylist,
  readVariants,
  segmentExtension,
} from "./hls-plan.mts";

const base = "https://cdn.test/hls/master.m3u8";
const master = [
  "#EXTM3U",
  "#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360",
  "360.m3u8",
  "#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=1280x720",
  "720.m3u8",
  "#EXT-X-STREAM-INF:BANDWIDTH=6000000,RESOLUTION=1920x1080",
  "1080.m3u8",
].join("\n");

test("tells a master from a media playlist", () => {
  assert.equal(isMaster(master), true);
  assert.equal(isMaster("#EXTM3U\n#EXTINF:4,\nseg1.ts"), false);
});

test("reads every variant with its bandwidth and height", () => {
  const variants = readVariants(master, base);
  assert.equal(variants.length, 3);
  assert.deepEqual(variants[1], {
    uri: "https://cdn.test/hls/720.m3u8",
    bandwidth: 2400000,
    height: 720,
  });
});

test("takes the best variant that fits under the cap", () => {
  const variants = readVariants(master, base);
  assert.equal(pickVariant(variants, 720)?.height, 720);
  assert.equal(pickVariant(variants, 1080)?.height, 1080);
  assert.equal(pickVariant(variants, Infinity)?.height, 1080, "no cap means highest bitrate");
});

test("takes the smallest when nothing fits, rather than nothing at all", () => {
  const variants = readVariants(master, base);
  assert.equal(pickVariant(variants, 144)?.height, 360);
  assert.equal(pickVariant([], 720), null);
});

test("falls back on bandwidth when no resolution is advertised", () => {
  const text = [
    "#EXT-X-STREAM-INF:BANDWIDTH=900000",
    "a.m3u8",
    "#EXT-X-STREAM-INF:BANDWIDTH=300000",
    "b.m3u8",
  ].join("\n");
  assert.equal(pickVariant(readVariants(text, base), 720)?.bandwidth, 300000);
});

test("names a local segment after what the uri actually is", () => {
  assert.equal(segmentExtension("seg1.ts?token=x"), ".ts");
  assert.equal(segmentExtension("seg1.M4S"), ".m4s");
  assert.equal(segmentExtension("seg1.mp4"), ".mp4");
  assert.equal(segmentExtension("seg1.aac"), ".aac");
  assert.equal(segmentExtension("seg1"), ".ts");
});

test("rewrites every uri to a local file name", () => {
  const media = [
    "#EXTM3U",
    '#EXT-X-KEY:METHOD=AES-128,URI="https://cdn.test/k?token=1",IV=0x1',
    '#EXT-X-MAP:URI="init/start.mp4"',
    "#EXTINF:4,",
    "seg1.ts",
    "#EXTINF:4,",
    "https://other.test/seg2.m4s",
  ].join("\n");

  const plan = planLocalPlaylist(media, "https://cdn.test/hls/media.m3u8");
  assert.equal(plan.keyUrl, "https://cdn.test/k?token=1");
  assert.equal(plan.mapUrl, "https://cdn.test/hls/init/start.mp4");
  assert.deepEqual(plan.segments, [
    { url: "https://cdn.test/hls/seg1.ts", name: "seg00000.ts" },
    { url: "https://other.test/seg2.m4s", name: "seg00001.m4s" },
  ]);
  assert.match(plan.playlist, /URI="key.bin",IV=0x1/);
  assert.match(plan.playlist, /#EXT-X-MAP:URI="init.mp4"/);
  assert.match(plan.playlist, /^seg00000\.ts$/m);
});

test("leaves an unencrypted playlist alone", () => {
  const plan = planLocalPlaylist("#EXT-X-KEY:METHOD=NONE\nseg1.ts", base);
  assert.equal(plan.keyUrl, null);
  assert.match(plan.playlist, /METHOD=NONE/);
});
