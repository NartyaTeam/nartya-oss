import assert from "node:assert/strict";
import { test } from "node:test";
import { boostLabel, saveBoost, savedBoost } from "./boost.ts";

const memory = () => {
  const values = new Map<string, string>();
  return { get: (key: string) => values.get(key) ?? null, set: values.set.bind(values) };
};

test("a boost is kept from one launch to the next", () => {
  const store = memory();
  saveBoost(store, 2);
  assert.equal(savedBoost(store), 2);
});

test("nothing saved, or a value no longer offered, plays the track as it is", () => {
  const store = memory();
  assert.equal(savedBoost(store), 1);
  store.set("nartya:audio-boost", "7");
  assert.equal(savedBoost(store), 1);
});

test("a boost reads as a percentage", () => {
  assert.equal(boostLabel(1.5), "150 %");
});
