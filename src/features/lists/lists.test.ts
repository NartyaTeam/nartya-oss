import assert from "node:assert/strict";
import { test } from "node:test";
import { countByStatus, readEntries, statusLine } from "./lists.ts";

test("rows read from Supabase keep what the page needs", () => {
  assert.deepEqual(
    readEntries([
      { anime_slug: "one-piece", status: "watching", anime_title: "One Piece", anime_cover: "c" },
    ]),
    [{ slug: "one-piece", title: "One Piece", cover: "c", status: "watching", changedAt: null }],
  );
});

test("an unknown status, or no slug, is dropped", () => {
  assert.deepEqual(
    readEntries([
      { anime_slug: "a", status: "paused" },
      { status: "planned", anime_title: "B" },
    ]),
    [],
  );
  assert.deepEqual(readEntries(null), []);
});

test("one anime held under two slugs shows once, as the first row", () => {
  const entries = readEntries([
    { anime_slug: "one-piece", status: "watching", anime_title: "One Piece" },
    { anime_slug: "one-piece-2", status: "planned", anime_title: " one piece " },
    { anime_slug: "naruto", status: "planned" },
  ]);
  assert.deepEqual(
    entries.map((entry) => [entry.slug, entry.status]),
    [
      ["one-piece", "watching"],
      ["naruto", "planned"],
    ],
  );
});

test("every status is counted, including the empty ones", () => {
  const entries = readEntries([
    { anime_slug: "a", status: "watching" },
    { anime_slug: "b", status: "watching" },
    { anime_slug: "c", status: "dropped" },
  ]);
  assert.deepEqual(countByStatus(entries), { watching: 2, planned: 0, completed: 0, dropped: 1 });
});

test("the date says when the status changed, with the year only when it is another", () => {
  const now = new Date(2026, 8, 26);
  assert.equal(
    statusLine("watching", new Date(2026, 0, 17).toISOString(), now),
    "En cours depuis le 17 janvier",
  );
  assert.equal(
    statusLine("completed", new Date(2025, 11, 1).toISOString(), now),
    "Terminé le 1 décembre 2025",
  );
  assert.equal(statusLine("dropped", null, now), null);
  assert.equal(statusLine("planned", "not a date", now), null);
});
