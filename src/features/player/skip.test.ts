import assert from "node:assert/strict";
import { test } from "node:test";
import { countdownAt, creditsAt } from "./skip.ts";

const skips = { intro: { start: 60, end: 150 }, outro: { start: 1300, end: 1390 } };

test("the credits are the segment the time is in, and nothing between them", () => {
  assert.equal(creditsAt(skips, 30, 1420), null);
  assert.deepEqual(creditsAt(skips, 60, 1420), { kind: "intro", end: 150, sceneAfter: false });
  assert.equal(creditsAt(skips, 700, 1420), null);
  assert.equal(creditsAt(skips, 1300, 1420)?.kind, "outro");
  assert.equal(creditsAt(null, 100, 1420), null);
});

test("the last half second of a segment offers no skip", () => {
  assert.equal(creditsAt(skips, 149.4, 1420)?.kind, "intro");
  assert.equal(creditsAt(skips, 149.6, 1420), null);
});

test("a scene follows the ending only when there is more than a rounding error left", () => {
  assert.equal(creditsAt(skips, 1350, 1420)?.sceneAfter, true);
  assert.equal(creditsAt(skips, 1350, 1392)?.sceneAfter, false);
});

test("the end card counts the last ten seconds down in whole seconds", () => {
  assert.equal(countdownAt(1400, 1420), null);
  assert.equal(countdownAt(1410, 1420), 10);
  assert.equal(countdownAt(1414.2, 1420), 6);
  assert.equal(countdownAt(1420, 1420), null);
  assert.equal(countdownAt(10, Number.NaN), null);
});
