import assert from "node:assert/strict";
import { test } from "node:test";
import { createResourceStore, type Kept } from "./resource-store.ts";

function disk(initial: Record<string, string> = {}): Kept & { written: string[] } {
  const held = new Map(Object.entries(initial));
  const written: string[] = [];
  return {
    written,
    get: (key) => held.get(key) ?? null,
    set: (key, value) => {
      written.push(key);
      held.set(key, value);
    },
  };
}

const MINUTE = 60_000;

test("keeps a value in memory and calls it fresh for a while", () => {
  let clock = 1_000;
  const store = createResourceStore({ now: () => clock, kept: null });

  store.set("home", { rows: 2 });
  assert.deepEqual(store.get<{ rows: number }>("home")?.data, { rows: 2 });
  assert.equal(store.isFresh(store.get("home")), true);

  clock += 11 * MINUTE;
  assert.equal(store.isFresh(store.get("home")), false, "still there, no longer fresh");
  assert.deepEqual(store.get<{ rows: number }>("home")?.data, { rows: 2 });
});

test("nothing is written to disk unless asked", () => {
  const kept = disk();
  const store = createResourceStore({ kept });

  store.set("search:one", [1]);
  assert.deepEqual(kept.written, []);

  store.set("home", [1], true);
  assert.deepEqual(kept.written, ["home"]);
});

test("a value from a previous launch fills the screen but counts as stale", () => {
  const kept = disk({ home: JSON.stringify({ data: { rows: 1 }, at: 5_000 }) });
  const store = createResourceStore({ now: () => 6_000, kept });

  const entry = store.get<{ rows: number }>("home");
  assert.deepEqual(entry?.data, { rows: 1 });
  assert.equal(store.isFresh(entry), false, "it is refreshed behind the screen, always");
});

test("a value older than the keep window is not shown at all", () => {
  const old = JSON.stringify({ data: "old", at: 1_000 });
  const store = createResourceStore({
    now: () => 1_000 + 8 * 24 * 60 * 60_000,
    kept: disk({ home: old }),
  });

  assert.equal(store.get("home"), null);
});

test("unreadable storage is no storage", () => {
  const broken = createResourceStore({ now: () => 0, kept: disk({ home: "{not json" }) });
  assert.equal(broken.get("home"), null);

  const half = createResourceStore({ now: () => 0, kept: disk({ home: '{"data":1}' }) });
  assert.equal(half.get("home"), null);
});

test("a full quota does not break the read path", () => {
  const kept: Kept = {
    get: () => null,
    set: () => {
      throw new Error("QuotaExceededError");
    },
  };
  const store = createResourceStore({ kept });

  store.set("home", "value", true);
  assert.equal(store.get<string>("home")?.data, "value");
});
