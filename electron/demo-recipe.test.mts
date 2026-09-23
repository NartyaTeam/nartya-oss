import assert from "node:assert/strict";
import { test } from "node:test";
import { demoRecipe, DEMO_SOURCE_KEY } from "./demo-recipe.mts";
import { DEMO_STREAMS } from "./endpoints.mts";
import { createRecipeStore, fetchRecipe } from "./source-recipe.mts";

test("covers the host of every demo stream", () => {
  const source = demoRecipe().sources[DEMO_SOURCE_KEY];
  for (const stream of DEMO_STREAMS) {
    assert.ok(source?.domains?.includes(new URL(stream.url).hostname), stream.url);
  }
});

test("names no host and sends no header of its own", () => {
  const recipe = demoRecipe();
  assert.deepEqual(recipe.defaultHeaders, {});
  assert.deepEqual(recipe.sources[DEMO_SOURCE_KEY]?.headers, {});
  assert.equal(recipe.sources[DEMO_SOURCE_KEY]?.strategy, undefined);
});

test("is what a store without an api base ends up with", async () => {
  const store = createRecipeStore(fetchRecipe);
  const loaded = await store.ensure();

  assert.equal(store.detectKey(DEMO_STREAMS[0]?.url ?? ""), DEMO_SOURCE_KEY);
  assert.equal(loaded?.version, 0);
});

test("recognises the demo hosts, and nothing else", () => {
  const store = createRecipeStore(fetchRecipe);
  store.set(demoRecipe());

  assert.equal(store.detectKey(DEMO_STREAMS[0]?.url ?? ""), DEMO_SOURCE_KEY);
  assert.equal(store.detectKey("https://elsewhere.test/a.mp4"), null);
});
