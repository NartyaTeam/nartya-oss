import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loadProfile,
  parseProfile,
  shouldTouchLastLogin,
  type ProfileSource,
  type UserCheck,
} from "./profile.ts";

const HOUR = 60 * 60_000;
const NOW = Date.parse("2026-09-22T12:00:00.000Z");

function fixture(row: unknown, { failed = false, check = "valid" as UserCheck } = {}) {
  const touched: string[] = [];
  let checks = 0;

  const source: ProfileSource = {
    fetch: async () => ({ row, failed }),
    confirmUser: async () => {
      checks += 1;
      return check;
    },
    touch: async (_id, at) => void touched.push(at),
  };

  return { source, touched, checks: () => checks };
}

test("keeps only the columns the app reads, whatever the row carries", () => {
  const parsed = parseProfile({
    id: "u1",
    username: "zeleff",
    avatar: null,
    last_login: "2026-09-01T00:00:00.000Z",
    unexpected: { deeply: "nested" },
  });
  assert.deepEqual(parsed, {
    id: "u1",
    username: "zeleff",
    avatar: null,
    lastLogin: "2026-09-01T00:00:00.000Z",
  });
});

test("a row without an id is not a profile", () => {
  assert.equal(parseProfile(null), null);
  assert.equal(parseProfile({}), null);
  assert.equal(parseProfile({ id: 7 }), null);
  assert.equal(parseProfile("row"), null);
  assert.deepEqual(parseProfile({ id: "u1", username: 42 }), {
    id: "u1",
    username: null,
    avatar: null,
    lastLogin: null,
  });
});

test("last login is written at most once an hour", () => {
  assert.equal(shouldTouchLastLogin(null, NOW), true);
  assert.equal(shouldTouchLastLogin("not a date", NOW), true);
  assert.equal(shouldTouchLastLogin(new Date(NOW - 2 * HOUR).toISOString(), NOW), true);
  assert.equal(shouldTouchLastLogin(new Date(NOW - 59 * 60_000).toISOString(), NOW), false);
  assert.equal(shouldTouchLastLogin(new Date(NOW).toISOString(), NOW), false);
});

test("loads the profile and stamps a stale last login", async () => {
  const probe = fixture({ id: "u1", username: "zeleff", last_login: null });
  const loaded = await loadProfile(probe.source, "u1", NOW);

  assert.equal(loaded.profile?.username, "zeleff");
  assert.equal(loaded.signOut, false);
  assert.deepEqual(probe.touched, ["2026-09-22T12:00:00.000Z"]);
  assert.equal(probe.checks(), 0, "a profile that is there needs no authority check");
});

test("a fresh last login is left alone", async () => {
  const recent = new Date(NOW - 10 * 60_000).toISOString();
  const probe = fixture({ id: "u1", last_login: recent });

  await loadProfile(probe.source, "u1", NOW);
  assert.deepEqual(probe.touched, []);
});

test("a missing row on a deleted account signs out", async () => {
  const probe = fixture(null, { check: "gone" });
  assert.deepEqual(await loadProfile(probe.source, "u1", NOW), { profile: null, signOut: true });
  assert.equal(probe.checks(), 1);
});

test("a missing row with the account still valid is a race, not a sign out", async () => {
  const probe = fixture(null, { check: "valid" });
  assert.deepEqual(await loadProfile(probe.source, "u1", NOW), { profile: null, signOut: false });
});

test("offline is not a reason to lose access", async () => {
  const unknown = fixture(null, { check: "unknown" });
  assert.deepEqual(await loadProfile(unknown.source, "u1", NOW), { profile: null, signOut: false });

  const failed = fixture(null, { failed: true, check: "gone" });
  assert.deepEqual(await loadProfile(failed.source, "u1", NOW), { profile: null, signOut: false });
  assert.equal(failed.checks(), 0, "a failed read says nothing about the account");
});
