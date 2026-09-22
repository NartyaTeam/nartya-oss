import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanTitle,
  episodeKey,
  foldByEpisode,
  readResume,
  rowFor,
  shouldSave,
  watchedOf,
} from "./progress.ts";

test("an episode is keyed by everything that makes it a distinct watch", () => {
  assert.equal(episodeKey("one-piece", "saison1", 12, "vostfr"), "one-piece:saison1:12:vostfr");
  assert.notEqual(
    episodeKey("one-piece", "saison1", 12, "vf"),
    episodeKey("one-piece", "saison1", 12, "vostfr"),
  );
});

test("ninety percent in is watched, and nothing goes past a hundred", () => {
  assert.deepEqual(watchedOf(0, 100), { percent: 0, completed: false });
  assert.deepEqual(watchedOf(89, 100), { percent: 89, completed: false });
  assert.deepEqual(watchedOf(90, 100), { percent: 90, completed: true });
  assert.deepEqual(watchedOf(140, 100), { percent: 100, completed: true });
});

test("a duration nobody knows yet is no progress, not a division by zero", () => {
  assert.deepEqual(watchedOf(30, 0), { percent: 0, completed: false });
});

test("the placeholder title is not written into someone's history", () => {
  assert.equal(cleanTitle("Sans titre"), null);
  assert.equal(cleanTitle("  "), null);
  assert.equal(cleanTitle(null), null);
  assert.equal(cleanTitle("  One Piece "), "One Piece");
});

test("saves closer than five seconds are one save, unless forced", () => {
  assert.equal(shouldSave(null, 1000, false), true);
  assert.equal(shouldSave(1000, 3000, false), false);
  assert.equal(shouldSave(1000, 6000, false), true);
  assert.equal(shouldSave(1000, 3000, true), true);
});

test("watching again is what puts an anime back in the resume row", () => {
  const row = rowFor(
    "user-1",
    {
      slug: "one-piece",
      seasonId: "saison1",
      episodeNumber: 12,
      language: "vostfr",
      positionSeconds: 95,
      duration: 100,
      title: "Sans titre",
      cover: null,
    },
    "2026-09-22T10:00:00.000Z",
  );

  assert.equal(row["episode_key"], "one-piece:saison1:12:vostfr");
  assert.equal(row["hidden_from_resume"], false);
  assert.equal(row["completed"], true);
  assert.equal(row["anime_title"], null);
});

test("the furthest language is the one the tick shows", () => {
  const rows = [
    { season_id: "saison1", episode_number: 1, progress_percent: 20, completed: false },
    { season_id: "saison1", episode_number: 1, progress_percent: 95, completed: true },
    { season_id: "saison1", episode_number: 2, progress_percent: 10, completed: false },
  ];
  assert.deepEqual(foldByEpisode(rows), {
    "saison1:1": { percent: 95, completed: true },
    "saison1:2": { percent: 10, completed: false },
  });
});

test("rows that say nothing are skipped rather than counted as zero", () => {
  assert.deepEqual(foldByEpisode([{ season_id: "saison1" }, { episode_number: 1 }, null]), {});
  assert.deepEqual(foldByEpisode(null), {});
});

test("a resume needs a season and an episode to be one", () => {
  assert.equal(readResume({ language: "vf" }), null);
  assert.equal(readResume(null), null);
  assert.deepEqual(
    readResume({
      season_id: "saison1",
      episode_number: 3,
      language: "vf",
      progress_percent: 41.7,
      completed: false,
    }),
    { seasonId: "saison1", episodeNumber: 3, language: "vf", percent: 42, completed: false },
  );
});
