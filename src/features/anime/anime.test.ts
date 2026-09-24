import assert from "node:assert/strict";
import { test } from "node:test";
import type { Api, ApiResult } from "../../lib/api.ts";
import { createAnime } from "./anime.ts";

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

const page = { anime: { slug: "one-piece", title: "One Piece" } };

test("a slug travels encoded, and the season with it", async () => {
  const { api, asked } = fakeApi({ ok: true, data: page });
  const anime = createAnime(api);

  await anime.page("dr stone/silver");
  await anime.episodes("dr stone/silver", "saison 1");

  assert.deepEqual(asked, [
    "/anime/dr%20stone%2Fsilver/page",
    "/anime/dr%20stone%2Fsilver/seasons/saison%201/episodes?sources=v2",
  ]);
});

test("episodes are always asked for sealed", async () => {
  const { api, asked } = fakeApi({ ok: true, data: { episodes: [] } });
  await createAnime(api).episodes("one-piece", "saison1");
  assert.match(asked[0] ?? "", /\?sources=v2$/);
});

test("an answer the parser cannot read is a missing page, not a crash", async () => {
  const { api } = fakeApi({ ok: true, data: { anime: { slug: "" } } });
  const answer = await createAnime(api).page("ghost");
  assert.equal(answer.ok, false);
  assert.equal(answer.ok === false && answer.outdated, false);
});

test("a failure from the api passes through untouched", async () => {
  const failure = { ok: false, outdated: true, message: "trop vieux" } as const;
  const { api } = fakeApi(failure);
  assert.deepEqual(await createAnime(api).page("one-piece"), failure);
  assert.deepEqual(await createAnime(api).episodes("one-piece", "saison1"), failure);
});

test("skip segments are asked for one episode, with its season number", async () => {
  const { api, asked } = fakeApi({ ok: true, data: null });

  const answer = await createAnime(api).skips("one piece", "saison 1", 12, 3);

  assert.deepEqual(asked, ["/anime/one%20piece/seasons/saison%201/skip?episode=12&snum=3"]);
  assert.deepEqual(answer, { ok: true, data: null });
});
