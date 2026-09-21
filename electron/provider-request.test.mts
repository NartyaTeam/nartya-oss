import assert from "node:assert/strict";
import { test } from "node:test";
import { createRecipeStore, type Recipe } from "./source-recipe.mts";
import { createRequestBuilder } from "./provider-request.mts";

const recipe: Recipe = {
  defaultHeaders: { "User-Agent": "neutral" },
  sources: {
    s1: {
      domains: ["one.test"],
      headers: { "User-Agent": "one", Referer: "https://one.test/" },
      timeout: 5_000,
    },
    s2: {
      domains: ["two.test"],
      headers: {
        "User-Agent": "two",
        Referer: "https://stale.two.test/",
        Origin: "https://stale.two.test",
      },
      hostMatch: "two.test",
      canonicalHost: "live.two.test",
      dropRefererOffHost: true,
    },
    s3: {
      domains: ["three.test"],
      headers: {},
      mp4Referer: { pattern: "/v/([a-z0-9]+)\\.mp4", template: "https://three.test/e/{1}" },
    },
  },
};

function builder() {
  const store = createRecipeStore(async () => recipe);
  store.set(recipe);
  return createRequestBuilder(store);
}

test("uses the headers of the detected host", () => {
  const request = builder()("https://cdn.one.test/a.m3u8");
  assert.deepEqual(request.headers, { "User-Agent": "one", Referer: "https://one.test/" });
  assert.equal(request.timeoutMs, 5_000);
});

test("falls back to neutral headers on an unknown host", () => {
  const request = builder()("https://elsewhere.test/a.m3u8");
  assert.deepEqual(request.headers, { "User-Agent": "neutral" });
  assert.equal(request.timeoutMs, 30_000);
});

test("moves a dead extension to the canonical host", () => {
  assert.equal(builder()("https://old.two.test/a.mp4").url, "https://live.two.test/a.mp4");
  assert.equal(builder()("https://live.two.test/a.mp4").url, "https://live.two.test/a.mp4");
  assert.equal(builder()("not a url", "s2").url, "not a url");
});

test("follows the referer on the host and drops it off host", () => {
  const onHost = builder()("https://old.two.test/a.mp4");
  assert.equal(onHost.headers.Referer, "https://live.two.test/");
  assert.equal(onHost.headers.Origin, "https://live.two.test");

  const offHost = builder()("https://cdn.elsewhere.test/a.mp4", "s2");
  assert.equal(offHost.headers.Referer, undefined);
  assert.equal(offHost.headers.Origin, undefined);
});

test("rebuilds the player page referer from the media url", () => {
  const request = builder()("https://cdn.three.test/v/ab12cd.mp4", "s3");
  assert.equal(request.headers.Referer, "https://three.test/e/ab12cd");
  assert.equal(builder()("https://cdn.three.test/other.mp4", "s3").headers.Referer, undefined);
});

test("passes a range header through", () => {
  assert.equal(
    builder()("https://cdn.one.test/a.mp4", null, "bytes=0-99").headers.Range,
    "bytes=0-99",
  );
  assert.equal(builder()("https://cdn.one.test/a.mp4").headers.Range, undefined);
});
