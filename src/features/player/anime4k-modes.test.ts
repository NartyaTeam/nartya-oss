import assert from "node:assert/strict";
import { test } from "node:test";
import type { Store } from "./bandwidth.ts";
import { acknowledge, choiceLabel, saveChoice, savedChoice } from "./anime4k-modes.ts";

const memory = (): Store => {
  const held = new Map<string, string>();
  return { get: (key) => held.get(key) ?? null, set: (key, value) => held.set(key, value) };
};

const blocked: Store = {
  get: () => {
    throw new Error("blocked");
  },
  set: () => {
    throw new Error("blocked");
  },
};

test("a mode is only brought back once the warning was acknowledged", () => {
  const store = memory();
  saveChoice(store, "bb");
  assert.equal(savedChoice(store), "off");
  acknowledge(store);
  assert.equal(savedChoice(store), "bb");
});

test("anything that is not a mode reads as off", () => {
  const store = memory();
  acknowledge(store);
  store.set("nartya:anime4k", "z");
  assert.equal(savedChoice(store), "off");
});

test("blocked storage leaves Anime4K off without throwing", () => {
  assert.equal(savedChoice(blocked), "off");
  assert.doesNotThrow(() => saveChoice(blocked, "a"));
});

test("each choice has a label", () => {
  assert.equal(choiceLabel("off"), "Désactivé");
  assert.equal(choiceLabel("ca"), "Mode C+A");
});
