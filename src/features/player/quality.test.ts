import assert from "node:assert/strict";
import { test } from "node:test";
import type { Store } from "./bandwidth.ts";
import { levelForHeight, qualityOptions, saveQuality, savedQuality } from "./quality.ts";

const levels = [
  { height: 360, bitrate: 500_000 },
  { height: 1080, bitrate: 4_000_000 },
  { height: 720, bitrate: 2_000_000 },
  { height: 1080, bitrate: 6_000_000 },
];

function memory(seed: Record<string, string> = {}): Store {
  const held = new Map(Object.entries(seed));
  return {
    get: (key) => held.get(key) ?? null,
    set: (key, value) => void held.set(key, value),
  };
}

test("a height caps at the best variant that does not exceed it", () => {
  assert.equal(levelForHeight(levels, 720), 2);
  assert.equal(levelForHeight(levels, 540), 0);
});

test("of two variants at the same height, the richer one is kept", () => {
  assert.equal(levelForHeight(levels, 1080), 3);
});

test("a height under every variant falls back on the lowest", () => {
  assert.equal(levelForHeight(levels, 240), 0);
});

test("no variant at all caps nothing", () => {
  assert.equal(levelForHeight([], 720), -1);
});

test("the menu offers auto, then each height once, highest first", () => {
  assert.deepEqual(
    qualityOptions(levels, "auto").map((option) => option.label),
    ["Auto", "1080p", "720p", "360p"],
  );
});

test("the menu ticks the height the preference lands on, not the preference itself", () => {
  const ticked = (preference: number | "auto") =>
    qualityOptions(levels, preference).find((option) => option.selected)?.label;
  assert.equal(ticked("auto"), "Auto");
  assert.equal(ticked(720), "720p");
  assert.equal(ticked(900), "720p");
  assert.equal(ticked(240), "360p");
});

test("a single height, or none known, leaves nothing to choose", () => {
  assert.deepEqual(
    qualityOptions(
      [
        { height: 720, bitrate: 1 },
        { height: 720, bitrate: 2 },
      ],
      "auto",
    ),
    [],
  );
  assert.deepEqual(
    qualityOptions(
      [
        { height: 0, bitrate: 1 },
        { height: 0, bitrate: 2 },
      ],
      "auto",
    ),
    [],
  );
});

test("the choice outlives the episode, auto included", () => {
  const store = memory();
  assert.equal(savedQuality(store), "auto");
  saveQuality(store, 720);
  assert.equal(savedQuality(store), 720);
  saveQuality(store, "auto");
  assert.equal(savedQuality(store), "auto");
});

test("a stored value that is not a height reads as auto", () => {
  assert.equal(savedQuality(memory({ "nartya:quality": "max" })), "auto");
  assert.equal(savedQuality(memory({ "nartya:quality": "-480" })), "auto");
});

test("storage the viewer blocked neither throws nor loses the default", () => {
  const blocked: Store = {
    get: () => {
      throw new Error("blocked");
    },
    set: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(savedQuality(blocked), "auto");
  assert.doesNotThrow(() => {
    saveQuality(blocked, 720);
  });
});
