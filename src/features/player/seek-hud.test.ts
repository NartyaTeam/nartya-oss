import assert from "node:assert/strict";
import { test } from "node:test";
import { addSeek } from "./seek-hud.ts";

test("seeks in the same direction add up", () => {
  const once = addSeek(null, 10);
  assert.deepEqual(addSeek(once, 10), { forward: true, seconds: 20 });
});

test("turning back starts the count again", () => {
  assert.deepEqual(addSeek({ forward: true, seconds: 30 }, -10), { forward: false, seconds: 10 });
});
