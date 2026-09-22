import assert from "node:assert/strict";
import { test } from "node:test";
import { browseGenreFor } from "./genres.ts";

test("an anilist genre browses under its catalogue name", () => {
  assert.equal(browseGenreFor("Sci-Fi"), "Science-fiction");
  assert.equal(browseGenreFor("Mahou Shoujo"), "Magical girl");
});

test("a genre the catalogue does not know stays a plain tag", () => {
  assert.equal(browseGenreFor("Josei"), null);
  assert.equal(browseGenreFor("action"), null);
});
