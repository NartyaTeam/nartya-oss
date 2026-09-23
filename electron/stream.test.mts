import assert from "node:assert/strict";
import { test } from "node:test";
import { readEmbed, refusalOf, trustedEmbed } from "./stream.mts";

test("each refusal the api spells in a number says what to do about it", () => {
  assert.equal(refusalOf(401), "Connecte-toi pour lancer la lecture.");
  assert.equal(refusalOf(410), "Lien expiré, recharge l'épisode.");
  assert.equal(refusalOf(429), "Trop de lectures d'affilée, patiente un instant.");
});

test("an unexpected status carries its number, since nothing else describes it", () => {
  assert.equal(refusalOf(503), "Résolution indisponible (503)");
});

test("an embed is a url, and a provider only when the api named one", () => {
  assert.deepEqual(readEmbed({ data: { url: "https://host.test/e", provider: "s1" } }), {
    url: "https://host.test/e",
    provider: "s1",
  });
  assert.deepEqual(readEmbed({ data: { url: "https://host.test/e" } }), {
    url: "https://host.test/e",
    provider: null,
  });
  assert.deepEqual(readEmbed({ data: { url: "https://host.test/e", provider: "" } }), {
    url: "https://host.test/e",
    provider: null,
  });
});

test("an answer with no url is not an embed", () => {
  assert.equal(readEmbed({ data: { provider: "s1" } }), null);
  assert.equal(readEmbed({ data: { url: "" } }), null);
  assert.equal(readEmbed({}), null);
  assert.equal(readEmbed(null), null);
});

const known = (url: string): string | null => (new URL(url).hostname === "host.test" ? "s1" : null);

test("an embed on a host the recipe knows is trusted, under the key of that host", () => {
  assert.deepEqual(trustedEmbed({ url: "https://host.test/e", provider: "s1" }, known), {
    url: "https://host.test/e",
    provider: "s1",
  });
  assert.deepEqual(trustedEmbed({ url: "https://host.test/e", provider: null }, known), {
    url: "https://host.test/e",
    provider: "s1",
  });
});

test("an embed on a host the recipe does not know is never fetched", () => {
  assert.equal(trustedEmbed({ url: "https://elsewhere.test/e", provider: "s1" }, known), null);
});

test("an embed sealed for one source but living on another is refused", () => {
  assert.equal(trustedEmbed({ url: "https://host.test/e", provider: "s2" }, known), null);
});
