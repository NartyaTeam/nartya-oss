import assert from "node:assert/strict";
import { test } from "node:test";
import type { DownloadRequest } from "../../../shared/downloads.ts";
import type { Source } from "../anime/types.ts";
import { downloadOrder, prepare } from "./prepare.ts";

const source = (id: string, key: string): Source => ({
  id,
  key,
  label: key,
  rank: 0,
  recommended: false,
  slot: `eps-${key}`,
});
const sources = [source("t1", "s1"), source("t2", "s2"), source("t3", "s3")];
const details = {
  slug: "a",
  seasonId: "s",
  ep: 1,
  lang: "vf",
  animeTitle: "A",
  animeCover: null,
  epThumb: null,
  epTitle: null,
  seasonName: null,
};
const always = () => Promise.resolve(true);

test("the picked host goes first, the others follow in their order", () => {
  assert.deepEqual(
    downloadOrder(sources, "s2").map((entry) => entry.id),
    ["t2", "t1", "t3"],
  );
  assert.deepEqual(
    downloadOrder(sources, "auto").map((entry) => entry.id),
    ["t1", "t2", "t3"],
  );
});

test("a source that fails hands over to the next", async () => {
  const tried: string[] = [];
  const start = (request: DownloadRequest) => {
    tried.push(request.token);
    return Promise.resolve(
      request.token === "t2" ? { ok: true as const } : { ok: false as const, error: "mort" },
    );
  };
  assert.deepEqual(await prepare(start, always, details, sources, () => false), { ok: true });
  assert.deepEqual(tried, ["t1", "t2"]);
});

test("when every source fails, the last reason is what is shown", async () => {
  const start = (request: DownloadRequest) =>
    Promise.resolve({ ok: false as const, error: `refus ${request.token}` });
  assert.deepEqual(await prepare(start, always, details, sources, () => false), {
    ok: false,
    error: "refus t3",
  });
});

test("a cancelled preparation stops before the next resolution", async () => {
  let stopped = false;
  const start = () => {
    stopped = true;
    return Promise.resolve({ ok: false as const, error: "mort" });
  };
  const take = (isStopped: () => boolean) => Promise.resolve(!isStopped());
  assert.equal(await prepare(start, take, details, sources, () => stopped), null);
});
