import assert from "node:assert/strict";
import { test } from "node:test";
import type { Favorite, Favorites } from "./favorites.ts";
import { useFavorites } from "./store.ts";

const favorite = (slug: string): Favorite => ({ slug, title: slug, cover: null, genre: null });

function fakeApi(saved = true, rows: Favorite[] = []) {
  const calls: string[] = [];
  let release: () => void = () => undefined;
  const api: Favorites = {
    list: async (userId) => {
      calls.push(`list ${userId}`);
      return rows;
    },
    add: async (_userId, entry) => {
      calls.push(`add ${entry.slug}`);
      await new Promise<void>((done) => (release = done));
      return saved;
    },
    remove: async (_userId, slug) => {
      calls.push(`remove ${slug}`);
      await new Promise<void>((done) => (release = done));
      return saved;
    },
    reorder: async (slugs) => {
      calls.push(`reorder ${slugs.join(",")}`);
      return saved;
    },
  };
  return { api, calls, release: () => release() };
}

const fresh = () => useFavorites.setState({ userId: null, items: null, failed: null });
const slugs = () => useFavorites.getState().items?.map((entry) => entry.slug);

test("the list is read once per account", async () => {
  fresh();
  const { api, calls } = fakeApi(true, [favorite("a")]);
  await useFavorites.getState().load(api, "u1");
  await useFavorites.getState().load(api, "u1");
  await useFavorites.getState().load(api, "u2");

  assert.deepEqual(calls, ["list u1", "list u2"]);
});

test("a heart fills at once, before Supabase answers", async () => {
  fresh();
  const { api, release } = fakeApi();
  await useFavorites.getState().load(api, "u1");

  const done = useFavorites.getState().toggle(api, favorite("a"));
  assert.deepEqual(slugs(), ["a"]);
  release();
  await done;
  assert.deepEqual(slugs(), ["a"]);
  assert.equal(useFavorites.getState().failed, null);
});

test("a refused add is taken back, and says so on that anime", async () => {
  fresh();
  const { api, release } = fakeApi(false);
  await useFavorites.getState().load(api, "u1");

  const done = useFavorites.getState().toggle(api, favorite("a"));
  release();
  await done;
  assert.deepEqual(slugs(), []);
  assert.equal(useFavorites.getState().failed?.slug, "a");
});

test("a refused removal puts the favorite back", async () => {
  fresh();
  const { api, release } = fakeApi(false, [favorite("a"), favorite("b")]);
  await useFavorites.getState().load(api, "u1");

  const done = useFavorites.getState().toggle(api, favorite("a"));
  assert.deepEqual(slugs(), ["b"]);
  release();
  await done;
  assert.deepEqual(slugs()?.sort(), ["a", "b"]);
});

test("a new order shows at once, and a refused one goes back", async () => {
  fresh();
  const rows = [favorite("a"), favorite("b"), favorite("c")];
  const { api: saving } = fakeApi(true, rows);
  await useFavorites.getState().load(saving, "u1");
  await useFavorites.getState().reorder(saving, ["c", "a", "b"]);
  assert.deepEqual(slugs(), ["c", "a", "b"]);

  const { api: refusing } = fakeApi(false);
  await useFavorites.getState().reorder(refusing, ["b", "c", "a"]);
  assert.deepEqual(slugs(), ["c", "a", "b"]);
  assert.equal(useFavorites.getState().failed?.slug, null);
});

test("nothing is toggled before the list is known", async () => {
  fresh();
  const { api, calls } = fakeApi();
  await useFavorites.getState().toggle(api, favorite("a"));
  assert.deepEqual(calls, []);
});

test("a list arriving for an account already gone is dropped", async () => {
  fresh();
  let answer: (rows: Favorite[]) => void = () => undefined;
  const slow: Favorites = {
    ...fakeApi().api,
    list: () => new Promise((done) => (answer = done)),
  };
  const first = useFavorites.getState().load(slow, "u1");
  const { api } = fakeApi(true, [favorite("mine")]);
  await useFavorites.getState().load(api, "u2");

  answer([favorite("theirs")]);
  await first;
  assert.deepEqual(slugs(), ["mine"]);
});

test("a list that could not be read is not an empty collection, and can be read again", async () => {
  fresh();
  const failing: Favorites = { ...fakeApi().api, list: async () => null };
  await useFavorites.getState().load(failing, "u1");
  assert.equal(useFavorites.getState().items, null);
  assert.equal(useFavorites.getState().failed?.slug, null);

  const { api } = fakeApi(true, [favorite("a")]);
  await useFavorites.getState().load(api, "u1");
  assert.deepEqual(slugs(), ["a"]);
  assert.equal(useFavorites.getState().failed, null);
});
