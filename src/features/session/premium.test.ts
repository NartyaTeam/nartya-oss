import assert from "node:assert/strict";
import { test } from "node:test";
import { activeTier, downloadSlots } from "./premium.ts";
import type { Profile } from "./profile.ts";

const NOW = Date.parse("2026-09-24T12:00:00.000Z");
const profile = (premiumTier: string | null, premiumUntil: string | null): Profile => ({
  id: "u1",
  username: null,
  avatar: null,
  lastLogin: null,
  premiumTier,
  premiumUntil,
});

test("a tier counts until its end date, and for ever without one", () => {
  assert.equal(activeTier(profile("plus", "2026-10-01T00:00:00.000Z"), NOW), "plus");
  assert.equal(activeTier(profile("ultimate", null), NOW), "ultimate");
  assert.equal(activeTier(profile("plus", "2026-09-01T00:00:00.000Z"), NOW), null);
});

test("no profile, no tier, or a tier the app does not know gives the free offer", () => {
  assert.equal(activeTier(null, NOW), null);
  assert.equal(activeTier(profile(null, null), NOW), null);
  assert.equal(activeTier(profile("gold", null), NOW), null);
  assert.equal(activeTier(profile("plus", "not a date"), NOW), null);
});

test("each offer downloads its number of episodes at once", () => {
  assert.equal(downloadSlots(null), 2);
  assert.equal(downloadSlots("plus"), 5);
  assert.equal(downloadSlots("ultimate"), 99);
});
