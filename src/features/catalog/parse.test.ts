import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCard, parseCards, parseGenreCards, parseHero, parseHome, parseRow } from "./parse.ts";

const card = {
  id: "21",
  slug: "one-piece",
  title: "One Piece",
  cover: "https://images.example.test/one-piece.jpg",
  score: 8.7,
  genres: ["Action", "Aventure"],
  langs: ["vostfr", "vf"],
  releases: [{ lang: "vf", episode: 1122 }],
};

test("keeps the fields the cards read, and drops the rest", () => {
  assert.deepEqual(parseCard(card), {
    id: "21",
    slug: "one-piece",
    title: "One Piece",
    cover: "https://images.example.test/one-piece.jpg",
    score: 8.7,
    genres: ["Action", "Aventure"],
    langs: ["vostfr", "vf"],
  });
});

test("a card needs a slug and a title, the rest has defaults", () => {
  assert.equal(parseCard({ slug: "x" }), null);
  assert.equal(parseCard({ title: "X" }), null);
  assert.equal(parseCard(null), null);
  assert.equal(parseCard("one-piece"), null);

  assert.deepEqual(parseCard({ slug: "x", title: "X" }), {
    id: "x",
    slug: "x",
    title: "X",
    cover: "",
    score: null,
    genres: [],
    langs: [],
  });
});

test("a score that is not a number is no score", () => {
  assert.equal(parseCard({ ...card, score: "8.7" })?.score, null);
  assert.deepEqual(parseCard({ ...card, genres: ["Action", 7, null] })?.genres, ["Action"]);
});

test("the hero carries what the banner needs", () => {
  const hero = parseHero({
    ...card,
    fanart: "https://images.example.test/bg.jpg",
    description: "Luffy",
  });
  assert.equal(hero?.fanart, "https://images.example.test/bg.jpg");
  assert.equal(hero?.clearLogo, null);
  assert.equal(hero?.description, "Luffy");
});

test("a row reads its kind from the api's two spellings", () => {
  assert.equal(parseRow({ key: "trending", numbered: true, items: [card] })?.variant, "numbered");
  assert.equal(parseRow({ key: "latest", variant: "episode", items: [card] })?.variant, "episode");
  assert.equal(parseRow({ key: "action", items: [card] })?.variant, "plain");
});

test("one broken item does not take its row down", () => {
  const row = parseRow({ key: "action", title: "Action", items: [card, { slug: "" }, card] });
  assert.equal(row?.items.length, 2);
});

test("a row with nothing left to show is not a row", () => {
  assert.equal(parseRow({ key: "empty", items: [] }), null);
  assert.equal(parseRow({ key: "broken", items: [{ slug: "" }] }), null);
  assert.equal(parseRow({ items: [card] }), null, "no key, nothing to render by");
});

test("a home that answers nonsense is an empty home, not a crash", () => {
  assert.deepEqual(parseHome(null), { hero: [], rows: [] });
  assert.deepEqual(parseHome({ hero: "no", rows: 7 }), { hero: [], rows: [] });

  const home = parseHome({ hero: [card, {}], rows: [{ key: "a", items: [card] }, null] });
  assert.equal(home.hero.length, 1);
  assert.equal(home.rows.length, 1);
});

test("genre cards need a name, an image is a bonus", () => {
  assert.deepEqual(parseGenreCards([{ genre: "Action", image: "a.jpg" }, { image: "b.jpg" }]), [
    { genre: "Action", image: "a.jpg" },
  ]);
  assert.deepEqual(parseGenreCards("nope"), []);
});

test("a page of results keeps only what can be shown", () => {
  assert.deepEqual(parseCards([card, { slug: "" }]).length, 1);
  assert.deepEqual(parseCards(undefined), []);
});
