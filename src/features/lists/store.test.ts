import assert from "node:assert/strict";
import { test } from "node:test";
import type { Entry, Lists, Status } from "./lists.ts";
import { useLists } from "./store.ts";

const entry = (slug: string, status: Status = "planned"): Entry => ({
  slug,
  title: slug,
  cover: null,
  status,
  changedAt: null,
});

function fakeApi(saved = true, rows: Entry[] = []) {
  const calls: string[] = [];
  const api: Lists = {
    list: async () => rows,
    set: async (held) => {
      calls.push(`set ${held.slug} ${held.status}`);
      return saved;
    },
    remove: async (_userId, slug) => {
      calls.push(`remove ${slug}`);
      return saved;
    },
    reorder: async (status, slugs) => {
      calls.push(`reorder ${status} ${slugs.join(",")}`);
      return saved;
    },
  };
  return { api, calls };
}

const fresh = () => useLists.setState({ userId: null, items: null, failed: null });
const shown = () => useLists.getState().items?.map((held) => `${held.slug}:${held.status}`);

test("a new anime joins its list, and a known one changes list", async () => {
  fresh();
  const { api, calls } = fakeApi(true, [entry("a", "planned")]);
  await useLists.getState().load(api, "u1");

  await useLists.getState().place(api, entry("b", "watching"));
  await useLists.getState().place(api, entry("a", "completed"));

  assert.deepEqual(shown(), ["b:watching", "a:completed"]);
  assert.deepEqual(calls, ["set b watching", "set a completed"]);
});

test("choosing the status it already has sends nothing, so its dates stay", async () => {
  fresh();
  const { api, calls } = fakeApi(true, [entry("a", "watching")]);
  await useLists.getState().load(api, "u1");

  await useLists.getState().place(api, entry("a", "watching"));
  assert.deepEqual(calls, []);
});

test("a refused change goes back to where the anime was", async () => {
  fresh();
  const { api } = fakeApi(false, [entry("a", "planned")]);
  await useLists.getState().load(api, "u1");

  await useLists.getState().place(api, entry("a", "dropped"));
  await useLists.getState().place(api, entry("b", "watching"));

  assert.deepEqual(shown(), ["a:planned"]);
  assert.equal(useLists.getState().failed?.slug, "b");
});

test("a refused removal puts the anime back", async () => {
  fresh();
  const { api } = fakeApi(false, [entry("a"), entry("b")]);
  await useLists.getState().load(api, "u1");

  await useLists.getState().remove(api, "a");
  assert.deepEqual(shown()?.sort(), ["a:planned", "b:planned"]);
  assert.equal(useLists.getState().failed?.slug, "a");
});

test("reordering one list leaves the others as they were", async () => {
  fresh();
  const rows = [entry("a"), entry("x", "watching"), entry("b"), entry("c")];
  const { api, calls } = fakeApi(true, rows);
  await useLists.getState().load(api, "u1");

  await useLists.getState().reorder(api, "planned", ["c", "a", "b"]);
  const planned = useLists.getState().items?.filter((held) => held.status === "planned");
  assert.deepEqual(
    planned?.map((held) => held.slug),
    ["c", "a", "b"],
  );
  assert.equal(useLists.getState().items?.length, 4);
  assert.deepEqual(calls, ["reorder planned c,a,b"]);
});

test("a list that could not be read can be read again", async () => {
  fresh();
  await useLists.getState().load({ ...fakeApi().api, list: async () => null }, "u1");
  assert.equal(useLists.getState().items, null);
  assert.equal(useLists.getState().failed?.slug, null);

  await useLists.getState().load(fakeApi(true, [entry("a")]).api, "u1");
  assert.deepEqual(shown(), ["a:planned"]);
});

test("a status just chosen is dated now, before Supabase answers", async () => {
  fresh();
  const { api } = fakeApi(true, [entry("a", "planned")]);
  await useLists.getState().load(api, "u1");

  const before = Date.now();
  await useLists.getState().place(api, entry("a", "watching"));
  const changedAt = useLists.getState().items?.[0]?.changedAt;
  assert.ok(changedAt && Date.parse(changedAt) >= before);
});
