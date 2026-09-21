import assert from "node:assert/strict";
import { test } from "node:test";
import { createRecipeStore, type Recipe } from "./source-recipe.mts";
import { createExtractor, parsePackedJwPlayer, unpackDeanEdwards } from "./video-extract.mts";

const recipe: Recipe = {
  sources: {
    s1: { domains: ["one.test"], strategy: "jw-sources", rejectPattern: "two\\.test" },
    s2: { domains: ["two.test"], strategy: "meta-og", mediaPattern: "https?://[^\"']+\\.mp4" },
    s3: { domains: ["three.test"], strategy: "player-src", mediaBase: "https://cdn.three.test" },
    s4: { domains: ["four.test"], strategy: "hls-json", exclusive: true },
    s5: { domains: ["five.test"], strategy: "packed-jw" },
    s6: { domains: ["six.test"], strategy: "brand-new" },
  },
};

function extractorWith(): ReturnType<typeof createExtractor> {
  const store = createRecipeStore(async () => recipe);
  store.set(recipe);
  return createExtractor(store);
}

const extract = extractorWith();

test("reads a jwplayer source list", () => {
  const html = `var p = { sources: [{ file: "https://cdn.one.test/a.m3u8" }] };`;
  assert.deepEqual(extract.extractFromHtml(html, "https://one.test/e/1"), {
    ok: true,
    url: "https://cdn.one.test/a.m3u8",
  });
});

test("falls back to any m3u8 in the page", () => {
  const html = `<script>var x = "https://cdn.one.test/b.m3u8?t=1";</script>`;
  const result = extract.extractFromHtml(html, "https://one.test/e/1");
  assert.deepEqual(result, { ok: true, url: "https://cdn.one.test/b.m3u8?t=1" });
});

test("refuses a stream the recipe marks as another host", () => {
  const html = `sources: [{ file: "https://cdn.two.test/a.m3u8" }]`;
  const result = extract.extractFromHtml(html, "https://one.test/e/1");
  assert.deepEqual(result, {
    ok: false,
    error: "Lien ambigu (autre hébergeur référencé dans la page)",
  });
});

test("reads og:video, then the media pattern, then the data attribute", () => {
  const og = `<meta property="og:video" content="https://cdn.two.test/a.mp4">`;
  assert.deepEqual(extract.extractFromHtml(og, "https://two.test/e"), {
    ok: true,
    url: "https://cdn.two.test/a.mp4",
  });

  const pattern = `<div>look at https://cdn.two.test/from-pattern.mp4 here</div>`;
  assert.deepEqual(extract.extractFromHtml(pattern, "https://two.test/e"), {
    ok: true,
    url: "https://cdn.two.test/from-pattern.mp4",
  });

  const attribute = `<div data-video-url="//cdn.two.test/rel.mp4"></div>`;
  assert.deepEqual(extract.extractFromHtml(attribute, "https://two.test/e"), {
    ok: true,
    url: "https://cdn.two.test/rel.mp4",
  });
});

test("resolves a relative player src against the recipe base", () => {
  const html = `player.src([{ src: "/media/a.mp4" }])`;
  assert.deepEqual(extract.extractFromHtml(html, "https://three.test/e"), {
    ok: true,
    url: "https://cdn.three.test/media/a.mp4",
  });
});

test("gives up on a relative src when the recipe has no base", () => {
  const store = createRecipeStore(async () => recipe);
  store.set({ sources: { s3: { domains: ["three.test"], strategy: "player-src" } } });
  const result = createExtractor(store).extractFromHtml(
    `player.src([{ src: "/media/a.mp4" }])`,
    "https://three.test/e",
  );
  assert.deepEqual(result, { ok: false, error: "Base média inconnue pour cette source" });
});

test("unescapes an hls url out of a json blob", () => {
  const html = `{"hls":"https:\\/\\/cdn.four.test\\/a.m3u8"}`;
  assert.deepEqual(extract.extractFromHtml(html, "https://four.test/e"), {
    ok: true,
    url: "https://cdn.four.test/a.m3u8",
  });
});

test("names an unknown source and an unknown strategy apart", () => {
  assert.deepEqual(extract.extractFromHtml("<html>", "https://nowhere.test/e"), {
    ok: false,
    error: "Source non reconnue",
  });
  assert.deepEqual(extract.extractFromHtml("<html>", "https://six.test/e"), {
    ok: false,
    error: "Stratégie d'extraction inconnue",
  });
  assert.deepEqual(extract.extractFromHtml("", "https://one.test/e"), {
    ok: false,
    error: "HTML invalide",
  });
});

test("unpacks a dean edwards payload without running it", () => {
  const packed =
    `eval(function(p,a,c,k,e,d){}('0 1="2";',10,3,` +
    `'var|file|https://cdn.five.test/a.m3u8'.split('|')))`;
  assert.equal(unpackDeanEdwards(packed), 'var file="https://cdn.five.test/a.m3u8";');
});

test("ignores a packed payload with an impossible radix", () => {
  const packed = `eval(function(p,a,c,k,e,d){}('0',99,1,'x'.split('|')))`;
  assert.equal(unpackDeanEdwards(packed), null);
});

test("finds the media in a packed player, directly or once unpacked", () => {
  const direct = `<script>file: "https://cdn.five.test/direct.m3u8"</script>`;
  assert.deepEqual(parsePackedJwPlayer(direct), {
    ok: true,
    url: "https://cdn.five.test/direct.m3u8",
  });

  const packed =
    `eval(function(p,a,c,k,e,d){}('0:"1";',10,2,` +
    `'file|https://cdn.five.test/packed.m3u8'.split('|')))`;
  assert.deepEqual(parsePackedJwPlayer(packed), {
    ok: true,
    url: "https://cdn.five.test/packed.m3u8",
  });

  assert.deepEqual(parsePackedJwPlayer("<html></html>"), {
    ok: false,
    error: "Flux HLS/MP4 non trouvé dans le lecteur",
  });
});

test("rejects a stream from an exclusive host served for another embed", () => {
  assert.equal(extract.matchesEmbed("https://one.test/e", "https://cdn.one.test/a.m3u8"), true);
  assert.equal(extract.matchesEmbed("https://one.test/e", "https://cdn.unknown.test/a.m3u8"), true);
  assert.equal(extract.matchesEmbed("https://one.test/e", "https://four.test/a.m3u8"), false);
  assert.equal(extract.matchesEmbed("https://one.test/e", "https://two.test/a.m3u8"), true);
  assert.equal(extract.matchesEmbed("", "https://one.test/a.m3u8"), false);
});
