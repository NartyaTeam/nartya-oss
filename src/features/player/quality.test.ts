import assert from "node:assert/strict";
import { test } from "node:test";
import type { Store } from "./bandwidth.ts";
import {
  levelForHeight,
  lockOptions,
  lockedLevel,
  qualityOptions,
  saveLock,
  saveQuality,
  savedLock,
  savedQuality,
} from "./quality.ts";

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

test("a lock on max takes the best variant of the highest height", () => {
  assert.equal(lockedLevel(levels, "max"), 3);
});

test("a lock on a height takes the best variant at or below it", () => {
  assert.equal(lockedLevel(levels, 720), 2);
  assert.equal(lockedLevel(levels, 240), 0);
});

test("a locked menu has no auto, and ticks the locked height", () => {
  const options = lockOptions(levels, "max");
  assert.deepEqual(
    options.map((option) => option.label),
    ["1080p", "720p", "360p"],
  );
  assert.equal(options.find((option) => option.selected)?.quality, 1080);
  assert.equal(lockOptions(levels, 720).find((option) => option.selected)?.quality, 720);
});

test("the lock is kept apart from the normal quality, and defaults to max", () => {
  const store = memory();
  assert.equal(savedLock(store), "max");
  saveQuality(store, 480);
  assert.equal(savedLock(store), "max");
  saveLock(store, 720);
  assert.equal(savedLock(store), 720);
  assert.equal(savedQuality(store), 480);
});
