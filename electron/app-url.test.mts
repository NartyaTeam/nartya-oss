import assert from "node:assert/strict";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { appUrlCheck, isHttpUrl } from "./app-url.mts";

test("accepts only http and https", () => {
  assert.equal(isHttpUrl("https://example.com"), true);
  assert.equal(isHttpUrl("http://example.com"), true);
  assert.equal(isHttpUrl("httpxyz://example.com"), false);
  assert.equal(isHttpUrl("file:///tmp/index.html"), false);
  assert.equal(isHttpUrl("not a url"), false);
});

test("matches the dev server by prefix", () => {
  const isAppUrl = appUrlCheck({ devUrl: "http://localhost:5173/" });
  assert.equal(isAppUrl("http://localhost:5173/anime/x"), true);
  assert.equal(isAppUrl("http://localhost:5174/"), false);
  assert.equal(isAppUrl("https://example.com"), false);
});

test("matches the packaged page by resolved path", () => {
  const file = "/opt/app/dist/index.html";
  const isAppUrl = appUrlCheck({ file });
  assert.equal(isAppUrl(pathToFileURL(file).href), true);
  assert.equal(isAppUrl(pathToFileURL("/opt/app/dist/other.html").href), false);
  assert.equal(isAppUrl("https://example.com"), false);
});

test("resolves percent encoded paths before comparing", () => {
  const file = "/opt/app/dist/café/index.html";
  assert.equal(appUrlCheck({ file })(pathToFileURL(file).href), true);
});
