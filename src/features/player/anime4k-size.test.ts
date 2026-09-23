import assert from "node:assert/strict";
import { test } from "node:test";
import { grownBase, upscaleTarget } from "./anime4k-size.ts";

test("a source is always doubled, never scaled by an in-between ratio", () => {
  assert.deepEqual(upscaleTarget({ width: 1280, height: 720 }), { width: 2560, height: 1440 });
  assert.deepEqual(upscaleTarget({ width: 1920, height: 1080 }), { width: 3840, height: 2160 });
});

test("a source that would double past 4K keeps its size", () => {
  assert.deepEqual(upscaleTarget({ width: 2560, height: 1440 }), { width: 2560, height: 1440 });
  assert.deepEqual(upscaleTarget({ width: 1920, height: 1200 }), { width: 1920, height: 1200 });
});

test("a lower variant is stretched to the chain rather than rebuilding it", () => {
  const base = { width: 1920, height: 1080 };
  assert.equal(grownBase(base, { width: 1280, height: 720 }), null);
  assert.equal(grownBase(base, base), null);
});

test("a higher variant grows the chain", () => {
  assert.deepEqual(grownBase({ width: 1280, height: 720 }, { width: 1920, height: 1080 }), {
    width: 1920,
    height: 1080,
  });
  assert.deepEqual(grownBase({ width: 0, height: 0 }, { width: 854, height: 480 }), {
    width: 854,
    height: 480,
  });
});
