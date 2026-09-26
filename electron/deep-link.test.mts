import assert from "node:assert/strict";
import { test } from "node:test";
import { createDeepLinks, linkIn, routeForLink } from "./deep-link.mts";

test("an anime link opens its page, with or without the website's open prefix", () => {
  assert.equal(routeForLink("nartya://anime/one-piece"), "/anime/one-piece");
  assert.equal(routeForLink("nartya://open/anime/one-piece"), "/anime/one-piece");
});

test("a browser's trailing slash, query or fragment is not part of the slug", () => {
  assert.equal(routeForLink("nartya://anime/one-piece/"), "/anime/one-piece");
  assert.equal(routeForLink("nartya://anime/one-piece?from=discord"), "/anime/one-piece");
  assert.equal(routeForLink("nartya://anime/one-piece#top"), "/anime/one-piece");
});

test("a slug cannot step out of the anime page", () => {
  assert.equal(routeForLink("nartya://anime/..%2F..%2Fwatch%2Fx"), "/anime/..%2F..%2Fwatch%2Fx");
  assert.equal(routeForLink("nartya://anime/a%22b"), "/anime/a%22b");
});

test("anything else is ignored", () => {
  assert.equal(routeForLink("nartya://anime/"), null);
  assert.equal(routeForLink("nartya://u/zeleff"), null);
  assert.equal(routeForLink("https://anime/one-piece"), null);
  assert.equal(routeForLink("nartya://anime/%E0%A4%A"), null);
  assert.equal(routeForLink(`nartya://anime/${"a".repeat(2100)}`), null);
});

test("the link is found among a launch's arguments", () => {
  assert.equal(linkIn(["app.exe", "--flag", "nartya://anime/x"]), "nartya://anime/x");
  assert.equal(linkIn(["app.exe", "--flag"]), null);
});

test("a received link waits to be taken, once", () => {
  const links = createDeepLinks();
  assert.equal(links.receive("nartya://u/zeleff"), false);
  assert.equal(links.take(), null);

  assert.equal(links.receive("nartya://anime/a"), true);
  assert.equal(links.receive("nartya://anime/b"), true);
  assert.equal(links.take(), "/anime/b");
  assert.equal(links.take(), null);
});
