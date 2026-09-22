import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateFor, remember, type Store } from "./bandwidth.ts";

function memory(seed: Record<string, string> = {}): Store {
  const held = new Map(Object.entries(seed));
  return {
    get: (key) => held.get(key) ?? null,
    set: (key, value) => void held.set(key, value),
  };
}

test("nothing measured yet starts at the default", () => {
  assert.equal(estimateFor(memory(), null), 3_000_000);
  assert.equal(estimateFor(memory(), "s1"), 3_000_000);
});

test("what a host sustained beats the global average, since hosts differ by tenfold", () => {
  const store = memory();
  remember(store, 20_000_000, "s1");
  remember(store, 3_000_000, "s2");
  assert.equal(estimateFor(store, "s1"), 16_000_000);
  assert.equal(estimateFor(store, "s2"), 2_400_000);
});

test("a host never measured falls back to the global figure", () => {
  const store = memory();
  remember(store, 10_000_000, "s1");
  assert.equal(estimateFor(store, "s9"), 8_000_000);
});

test("one good fragment does not erase a host's history", () => {
  const store = memory();
  remember(store, 10_000_000, "s1");
  remember(store, 20_000_000, "s1");
  assert.equal(estimateFor(store, "s1"), Math.floor(13_000_000 * 0.8));
});

test("the estimate is capped, so an absurd reading cannot pick an unplayable variant", () => {
  const store = memory();
  remember(store, 500_000_000, "s1");
  assert.equal(estimateFor(store, "s1"), 30_000_000);
});

test("a reading too low to mean anything is not remembered", () => {
  const store = memory();
  remember(store, 100_000, "s1");
  assert.equal(estimateFor(store, "s1"), 3_000_000);
});

test("storage that throws is no storage, not a broken player", () => {
  const broken: Store = {
    get: () => {
      throw new Error("blocked");
    },
    set: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(estimateFor(broken, "s1"), 3_000_000);
  assert.doesNotThrow(() => remember(broken, 10_000_000, "s1"));
});

test("a corrupt host table is read as an empty one", () => {
  const store = memory({ "nartya:bandwidth-by-host": "{{{" });
  assert.equal(estimateFor(store, "s1"), 3_000_000);
});
