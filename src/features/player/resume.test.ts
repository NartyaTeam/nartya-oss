import assert from "node:assert/strict";
import { test } from "node:test";
import { resumeLink, watchLink } from "./resume.ts";

const started = {
  seasonId: "saison1",
  episodeNumber: 12,
  language: "vf",
  percent: 40,
  completed: false,
};

test("a watch link carries the season, the episode and the language", () => {
  assert.equal(
    watchLink("one-piece", "saison 1", 12, "vostfr"),
    "/watch/one-piece?saison=saison+1&ep=12&lang=vostfr",
  );
});

test("an episode left part way is resumed where it stands", () => {
  const link = resumeLink("one-piece", started, "saison1", "vostfr");
  assert.equal(link?.label, "Reprendre l'épisode 12");
  assert.match(link?.to ?? "", /ep=12&lang=vf/);
});

test("a finished episode points at the next one, not at its own credits", () => {
  const link = resumeLink("one-piece", { ...started, completed: true }, "saison1", "vostfr");
  assert.equal(link?.label, "Épisode 13");
  assert.match(link?.to ?? "", /ep=13/);
});

test("the language it was watched in wins over the one being browsed", () => {
  assert.match(resumeLink("x", started, "saison1", "vostfr")?.to ?? "", /lang=vf/);
  assert.match(
    resumeLink("x", { ...started, language: "" }, "saison1", "vostfr")?.to ?? "",
    /lang=vostfr/,
  );
});

test("nothing watched yet is an invitation to start", () => {
  const link = resumeLink("one-piece", null, "saison1", "vostfr");
  assert.equal(link?.label, "Commencer");
  assert.match(link?.to ?? "", /ep=1/);
});

test("with no season there is nothing to start", () => {
  assert.equal(resumeLink("one-piece", null, null, "vostfr"), null);
});
