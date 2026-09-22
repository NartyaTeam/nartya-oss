import assert from "node:assert/strict";
import { test } from "node:test";
import { forcedFor } from "./use-resource.ts";

test("a retry counts for the key it was asked for", () => {
  assert.equal(forcedFor({ key: "genre:action", count: 2 }, "genre:action"), 2);
});

test("moving to another key forgets the retry, so the cache is read again", () => {
  assert.equal(forcedFor({ key: "genre:action", count: 1 }, "genre:drame"), 0);
});
