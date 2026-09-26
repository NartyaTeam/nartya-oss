import assert from "node:assert/strict";
import { test } from "node:test";
import { moved } from "./moved.ts";

test("moving an item shifts the others around it", () => {
  assert.deepEqual(moved(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(moved(["a", "b", "c", "d"], 3, 1), ["a", "d", "b", "c"]);
  assert.deepEqual(moved(["a", "b"], 5, 0), ["a", "b"]);
});
