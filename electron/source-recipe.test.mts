import assert from "node:assert/strict";
import { test } from "node:test";
import { compilePattern, createRecipeStore, readRecipe, type Recipe } from "./source-recipe.mts";

const recipe: Recipe = {
  version: 3,
  defaultHeaders: { "User-Agent": "nartya" },
  sources: {
    s1: { domains: ["one.test"], strategy: "jw-sources", exclusive: true },
    s2: { domains: ["two.test", "two.example"], strategy: "meta-og" },
  },
};

function counting(answer: Recipe = recipe) {
  const load = async () => {
    load.calls += 1;
    return answer;
  };
  load.calls = 0;
  return load;
}

const credentials = { apiBaseUrl: "https://api.test", accessToken: "t" };

test("loads once and serves the cache until it expires", async () => {
  const load = counting();
  const store = createRecipeStore(load, 60_000);

  assert.equal(await store.ensure(credentials), recipe);
  assert.equal(await store.ensure(), recipe);
  assert.equal(load.calls, 1);
});

test("shares a single request between concurrent callers", async () => {
  const load = counting();
  const store = createRecipeStore(load);

  const [first, second] = await Promise.all([store.ensure(credentials), store.ensure()]);
  assert.equal(first, recipe);
  assert.equal(second, recipe);
  assert.equal(load.calls, 1);
});

test("keeps the previous recipe when a reload fails", async () => {
  let fail = false;
  const store = createRecipeStore(async () => {
    if (fail) throw new Error("down");
    return recipe;
  }, 0);

  await store.ensure(credentials);
  fail = true;
  assert.equal(await store.ensure(), recipe);
});

test("loads without credentials, which is what the demo recipe is for", async () => {
  const load = counting();
  const store = createRecipeStore(load);

  assert.equal(await store.ensure(), recipe);
  assert.equal(load.calls, 1);
});

test("detects a source by domain and answers null without a recipe", () => {
  const store = createRecipeStore(counting());
  assert.equal(store.detectKey("https://cdn.two.test/a.m3u8"), null);

  store.set(recipe);
  assert.equal(store.detectKey("https://CDN.One.test/embed/42"), "s1");
  assert.equal(store.detectKey("https://two.example/x"), "s2");
  assert.equal(store.detectKey("https://elsewhere.test/x"), null);
});

test("allows embed hosts and their subdomains only", () => {
  const store = createRecipeStore(counting());
  assert.equal(store.isAllowedEmbedHost("one.test"), false);

  store.set(recipe);
  assert.equal(store.isAllowedEmbedHost("one.test"), true);
  assert.equal(store.isAllowedEmbedHost("play.one.test"), true);
  assert.equal(store.isAllowedEmbedHost("notone.test"), false);
  assert.equal(store.isAllowedEmbedHost("one.test.evil.example"), false);
});

test("exposes sources and default headers", () => {
  const store = createRecipeStore(counting());
  assert.deepEqual(store.defaultHeaders(), {});
  assert.equal(store.getSource("s1"), null);

  store.set(recipe);
  assert.deepEqual(store.defaultHeaders(), { "User-Agent": "nartya" });
  assert.equal(store.getSource("s1")?.strategy, "jw-sources");
  assert.equal(store.getSource("nope"), null);
  assert.equal(store.getSource(null), null);
});

test("reads a payload and rejects a malformed one", () => {
  assert.deepEqual(readRecipe({ data: { sources: { s1: {} }, version: 2 } }), {
    sources: { s1: {} },
    version: 2,
  });
  assert.equal(readRecipe({ data: { sources: [] } }), null);
  assert.equal(readRecipe({ data: {} }), null);
  assert.equal(readRecipe({}), null);
  assert.equal(readRecipe(null), null);
});

test("ignores an invalid pattern instead of throwing", () => {
  assert.equal(compilePattern("a(b")?.source, undefined);
  assert.equal(compilePattern(undefined), null);
  assert.equal(compilePattern("\\.mp4$")?.test("x.MP4"), true);
});

test("replaces the demo recipe as soon as credentials arrive", async () => {
  const demo: Recipe = { version: 0, sources: { demo: {} } };
  const store = createRecipeStore(async (creds) => (creds ? recipe : demo));

  assert.equal(await store.ensure(), demo);
  assert.equal(await store.ensure(credentials), recipe, "an hour of demo recipe after login");
});

test("reloads when the account changes", async () => {
  const load = counting();
  const store = createRecipeStore(load);

  await store.ensure(credentials);
  await store.ensure({ ...credentials, accessToken: "someone-else" });
  assert.equal(load.calls, 2);
});
