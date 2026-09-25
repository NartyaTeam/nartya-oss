import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStoredSession } from "./stored.ts";

const stored = { access_token: "a", refresh_token: "r", expires_at: 1, user: { id: "u1" } };

test("a session auth-js wrote is read back", () => {
  assert.equal(parseStoredSession(JSON.stringify(stored))?.user.id, "u1");
});

test("nothing stored, or something unreadable, is no session", () => {
  assert.equal(parseStoredSession(null), null);
  assert.equal(parseStoredSession("{"), null);
  assert.equal(parseStoredSession("null"), null);
  assert.equal(parseStoredSession(JSON.stringify({ ...stored, user: null })), null);
  assert.equal(parseStoredSession(JSON.stringify({ ...stored, refresh_token: 1 })), null);
});
