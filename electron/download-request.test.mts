import assert from "node:assert/strict";
import { test } from "node:test";
import { readDownloadRequest, readSeason } from "./download-request.mts";

const request = {
  token: "sealed",
  slug: "one-piece",
  seasonId: "saison1",
  ep: 12,
  lang: "vostfr",
  animeTitle: "One Piece",
  animeCover: null,
  epThumb: "https://img.test/12.jpg",
  epTitle: "Le duel",
  seasonName: "Saga 1",
};

test("a well formed request comes through as it is", () => {
  assert.deepEqual(readDownloadRequest(request), request);
});

test("a request without a token, a slug or a number is refused", () => {
  assert.equal(readDownloadRequest({ ...request, token: "" }), null);
  assert.equal(readDownloadRequest({ ...request, slug: 3 }), null);
  assert.equal(readDownloadRequest({ ...request, ep: "12" }), null);
  assert.equal(readDownloadRequest(null), null);
});

test("what only decorates the entry falls back instead of refusing", () => {
  const bare = readDownloadRequest({ token: "t", slug: "s", seasonId: "x", ep: 1, lang: "vf" });
  assert.equal(bare?.animeTitle, "s");
  assert.equal(bare?.epThumb, null);
});

test("a season to cancel needs its slug, its id and its language", () => {
  assert.deepEqual(readSeason({ slug: "s", seasonId: "x", lang: "vf" }), {
    slug: "s",
    seasonId: "x",
    lang: "vf",
  });
  assert.equal(readSeason({ slug: "s", seasonId: "x" }), null);
});
