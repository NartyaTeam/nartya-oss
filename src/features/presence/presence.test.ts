import assert from "node:assert/strict";
import { test } from "node:test";
import { presenceFor } from "./presence.ts";

const site = "https://site.test";

test("browsing shows the catalogue, with the site's button", () => {
  assert.deepEqual(presenceFor({ kind: "browsing" }, site), {
    details: "Navigue sur Nartya",
    state: "Exploration du catalogue",
    largeText: "Nartya — Streaming Anime",
    buttons: [{ label: "Visiter le site", url: site }],
  });
});

test("an anime page names the anime and links to it", () => {
  const presence = presenceFor({ kind: "choosing", slug: "one piece", title: "One Piece" }, site);
  assert.equal(presence.details, "Choix d'un épisode");
  assert.equal(presence.state, "One Piece");
  assert.equal(presence.largeText, "One Piece");
  assert.deepEqual(presence.buttons[0], {
    label: "Regarder cet anime",
    url: "https://site.test/open?anime=one%20piece",
  });
});

test("watching names the episode, and the season from the second one", () => {
  const first = { kind: "watching", slug: "a", title: "A", episode: 12, season: 1 } as const;
  assert.equal(presenceFor(first, site).details, "Regarde A");
  assert.equal(presenceFor(first, site).state, "Épisode 12");
  assert.equal(presenceFor({ ...first, season: 3 }, site).state, "Épisode 12 · Saison 3");
});

test("with no site, no buttons", () => {
  assert.deepEqual(presenceFor({ kind: "choosing", slug: "a", title: "A" }, null).buttons, []);
});
