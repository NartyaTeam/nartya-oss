import assert from "node:assert/strict";
import { test } from "node:test";
import { episodeLabel, seasonNumber } from "./episode-label.ts";

test("a season takes the first number of its name", () => {
  assert.equal(seasonNumber("Saison 2", 0), 2);
  assert.equal(seasonNumber("Saga 1 East Blue [Episode 1 à 61]", 4), 1);
});

test("a season without a number takes its place in the list", () => {
  assert.equal(seasonNumber("Film", 3), 4);
});

test("an episode reads as season, number and title", () => {
  assert.equal(
    episodeLabel("Saison 1", 0, { number: 4, title: "Naissance de la matrice" }),
    "S1 EP4 — Naissance de la matrice",
  );
  assert.equal(episodeLabel("Saison 1", 0, { number: 4, title: "" }), "S1 EP4");
});
