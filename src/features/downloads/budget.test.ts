import assert from "node:assert/strict";
import { test } from "node:test";
import { RESOLVES_PER_MINUTE, createBudget, waitFor } from "./budget.ts";

test("resolutions fit until the minute is full", () => {
  const full = Array.from({ length: RESOLVES_PER_MINUTE }, (_, i) => i * 100);
  assert.equal(waitFor(full.slice(1), 5_000), 0);
  assert.equal(waitFor(full, 5_000), 55_000);
});

test("a stamp older than a minute no longer counts", () => {
  const full = Array.from({ length: RESOLVES_PER_MINUTE }, () => 0);
  assert.equal(waitFor(full, 60_000), 0);
});

test("a stopped wait gives up instead of taking a slot", async () => {
  const take = createBudget(() => 0);
  for (let i = 0; i < RESOLVES_PER_MINUTE; i++) assert.equal(await take(() => false), true);
  assert.equal(await take(() => true), false);
});
