import assert from "node:assert/strict";
import { test } from "node:test";
import { createSegmentCache, isSegmentUrl } from "./segment-cache.mts";

const body = (size: number) => Buffer.alloc(size, 1);

test("tells a segment from an embed page", () => {
  assert.equal(isSegmentUrl("https://cdn.test/seg1.ts?token=x"), true);
  assert.equal(isSegmentUrl("https://cdn.test/seg1.M4S"), true);
  assert.equal(isSegmentUrl("https://cdn.test/audio.aac"), true);
  assert.equal(isSegmentUrl("https://cdn.test/movie.mp4"), true);
  assert.equal(isSegmentUrl("https://one.test/embed/movie.mp4"), false);
  assert.equal(isSegmentUrl("https://one.test/shell.php?v=a.mp4"), false);
  assert.equal(isSegmentUrl("https://cdn.test/a.m3u8"), false);
});

test("serves what it stored", () => {
  const cache = createSegmentCache();
  cache.put("https://cdn.test/1.ts", body(10), "video/mp2t");
  assert.deepEqual(cache.get("https://cdn.test/1.ts"), {
    body: body(10),
    contentType: "video/mp2t",
  });
  assert.equal(cache.get("https://cdn.test/2.ts"), null);
});

test("defaults the content type of a segment", () => {
  const cache = createSegmentCache();
  cache.put("https://cdn.test/1.ts", body(10), "");
  assert.equal(cache.get("https://cdn.test/1.ts")?.contentType, "video/mp2t");
});

test("refuses a segment bigger than the ceiling", () => {
  const cache = createSegmentCache();
  cache.put("https://cdn.test/big.ts", body(7 * 1024 * 1024), "video/mp2t");
  assert.equal(cache.get("https://cdn.test/big.ts"), null);
  assert.equal(cache.bytes, 0);
});

test("drops entries past their time to live", () => {
  let clock = 1_000;
  const cache = createSegmentCache(1_000_000, 500, () => clock);
  cache.put("https://cdn.test/1.ts", body(10), "video/mp2t");
  clock += 501;
  assert.equal(cache.get("https://cdn.test/1.ts"), null);
  assert.equal(cache.bytes, 0);
});

test("evicts the least recently used first", () => {
  const cache = createSegmentCache(30);
  cache.put("a", body(10), "video/mp2t");
  cache.put("b", body(10), "video/mp2t");
  cache.get("a");
  cache.put("c", body(10), "video/mp2t");
  cache.put("d", body(10), "video/mp2t");

  assert.equal(cache.get("b"), null, "b was the least recently used");
  assert.notEqual(cache.get("a"), null);
  assert.equal(cache.bytes, 30);
});

test("does not count a replaced entry twice", () => {
  const cache = createSegmentCache();
  cache.put("a", body(10), "video/mp2t");
  cache.put("a", body(20), "video/mp2t");
  assert.equal(cache.bytes, 20);
  assert.equal(cache.size, 1);
});
