import assert from "node:assert/strict";
import { test } from "node:test";
import { byGenre, matching, readFavorites, UNSORTED, type Favorite } from "./favorites.ts";

const favorite = (slug: string, genre: string | null = null): Favorite => ({
  slug,
  title: slug.toUpperCase(),
  cover: null,
  genre,
});

test("rows read from Supabase keep what the page needs", () => {
  assert.deepEqual(
    readFavorites([
      { anime_slug: "one-piece", anime_title: "One Piece", anime_cover: "c.jpg", genre: "Action" },
    ]),
    [{ slug: "one-piece", title: "One Piece", cover: "c.jpg", genre: "Action" }],
  );
});

test("a row with no title shows its slug, and a row with no slug is dropped", () => {
  assert.deepEqual(readFavorites([{ anime_slug: "a", anime_title: " " }, { anime_title: "B" }]), [
    { slug: "a", title: "a", cover: null, genre: null },
  ]);
  assert.deepEqual(readFavorites(null), []);
});

test("the search matches the title, whatever the case", () => {
  const list = [favorite("one-piece"), favorite("naruto")];
  assert.deepEqual(
    matching(list, " piece ").map((entry) => entry.slug),
    ["one-piece"],
  );
  assert.equal(matching(list, "").length, 2);
});

test("genres come largest first, and the unsorted last", () => {
  const groups = byGenre([
    favorite("a"),
    favorite("b", "Drame"),
    favorite("c", "Action"),
    favorite("d", "Action"),
  ]);
  assert.deepEqual(
    groups.map(([genre, items]) => [genre, items.length]),
    [
      ["Action", 2],
      ["Drame", 1],
      [UNSORTED, 1],
    ],
  );
});
