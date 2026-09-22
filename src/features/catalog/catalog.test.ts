import assert from "node:assert/strict";
import { test } from "node:test";
import type { Api, ApiResult } from "../../lib/api.ts";
import { createCatalog, PAGE_SIZE, searchQuery } from "./catalog.ts";

function fakeApi(answer: ApiResult<unknown>) {
  const asked: string[] = [];
  const api = {
    get: async (path: string) => {
      asked.push(path);
      return answer;
    },
  } as Api;
  return { api, asked };
}

const card = (slug: string) => ({ slug, title: slug });

test("only sends the filters that are set", () => {
  assert.equal(searchQuery({ search: "", genres: [], type: "", lang: "", page: 1 }), "page=1");
  assert.equal(
    searchQuery({
      search: " one piece ",
      genres: ["Action", "Aventure"],
      type: "TV",
      lang: "vf",
      page: 3,
    }),
    "search=one+piece&genre=Action%2CAventure&type=TV&lang=vf&page=3",
  );
});

test("a page below one is the first page", () => {
  assert.match(searchQuery({ search: "", genres: [], type: "", lang: "", page: 0 }), /page=1$/);
});

test("reads the home through the parser", async () => {
  const { api, asked } = fakeApi({ ok: true, data: { hero: [card("x")], rows: [] } });
  const result = await createCatalog(api).home();

  assert.deepEqual(asked, ["/home/sections"]);
  assert.equal(result.ok && result.data.hero[0]?.slug, "x");
});

test("a full page means there may be more, a short one is the end", async () => {
  const full = Array.from({ length: PAGE_SIZE }, (_, index) => card(`a${index}`));
  const { api } = fakeApi({ ok: true, data: full });
  assert.equal(
    (await createCatalog(api).search({ search: "a", genres: [], type: "", lang: "", page: 1 })).ok,
    true,
  );

  const complete = await createCatalog(api).search({
    search: "a",
    genres: [],
    type: "",
    lang: "",
    page: 1,
  });
  assert.equal(complete.ok && complete.data.hasMore, true);

  const short = fakeApi({ ok: true, data: [card("only")] });
  const end = await createCatalog(short.api).byGenre("Action", 2);
  assert.equal(end.ok && end.data.hasMore, false);
  assert.deepEqual(short.asked, ["/anime/genre/Action?page=2"]);
});

test("a genre with a slash or an accent survives the url", async () => {
  const { api, asked } = fakeApi({ ok: true, data: [] });
  await createCatalog(api).byGenre("Science-Fiction & Fantastique", 1);
  assert.deepEqual(asked, ["/anime/genre/Science-Fiction%20%26%20Fantastique?page=1"]);
});

test("a failure travels untouched, so the screen can say why", async () => {
  const { api } = fakeApi({ ok: false, outdated: true, message: "trop vieille" });
  const result = await createCatalog(api).home();

  assert.deepEqual(result, { ok: false, outdated: true, message: "trop vieille" });
});
