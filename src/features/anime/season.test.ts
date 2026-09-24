import assert from "node:assert/strict";
import { test } from "node:test";
import { availableLanguages, choiceOf, episodesIn, searchEpisodes, sourcesFor } from "./season.ts";
import type { Episode, Source } from "./types.ts";

const source = (slot: string, rank: number): Source => ({
  id: `token-${slot}`,
  key: slot,
  label: slot.toUpperCase(),
  rank,
  recommended: false,
  slot,
});

const episode = (number: number, sources: Record<string, Source[]>): Episode => ({
  number,
  title: `Épisode ${String(number)}`,
  description: null,
  thumbnail: null,
  airDate: null,
  length: null,
  shown: String(number),
  sources,
});

test("the languages of a season are every language any episode carries", () => {
  const season = [
    episode(1, { vostfr: [source("eps1", 1)] }),
    episode(2, { vostfr: [source("eps1", 1)], vf: [source("eps1", 1)] }),
  ];
  assert.deepEqual(availableLanguages(season), ["vostfr", "vf"]);
});

test("a host that only appears halfway through the run is still offered", () => {
  const season = [
    episode(1, { vostfr: [source("eps1", 1)] }),
    episode(2, { vostfr: [source("eps1", 1), source("eps2", 2)] }),
  ];
  assert.deepEqual(
    sourcesFor(season, "vostfr").map((entry) => entry.slot),
    ["eps1", "eps2"],
  );
});

test("sources come out by rank, whichever episode they were found on", () => {
  const season = [
    episode(1, { vostfr: [source("eps1", 5)] }),
    episode(2, { vostfr: [source("eps2", 1)] }),
  ];
  assert.deepEqual(
    sourcesFor(season, "vostfr").map((entry) => entry.slot),
    ["eps2", "eps1"],
  );
});

test("an episode missing from a language is not listed under it", () => {
  const season = [
    episode(1, { vostfr: [source("eps1", 1)], vf: [source("eps1", 1)] }),
    episode(2, { vostfr: [source("eps1", 1)] }),
  ];
  assert.deepEqual(
    episodesIn(season, "vf").map((entry) => entry.number),
    [1],
  );
  assert.deepEqual(sourcesFor(season, "va"), []);
});

test("a number searches for that episode, not for every one containing the digits", () => {
  const season = [1, 12, 112, 120].map((number) => episode(number, {}));
  assert.deepEqual(
    searchEpisodes(season, "12").map((entry) => entry.number),
    [12],
  );
});

test("a title is searched loosely, and case does not matter", () => {
  const season = [episode(1, {}), episode(2, {})];
  season[0] = { ...season[0]!, title: "Le pays d'ogre" };
  assert.deepEqual(
    searchEpisodes(season, "OGRE").map((entry) => entry.number),
    [1],
  );
});

test("an empty search is not a search", () => {
  const season = [episode(1, {}), episode(2, {})];
  assert.equal(searchEpisodes(season, "   ").length, 2);
});

test("the picker lists each host once, whichever slot it sits under", () => {
  const onHost = (slot: string, key: string, rank: number): Source => ({
    ...source(slot, rank),
    key,
  });
  const season = [
    episode(1, { vostfr: [onHost("eps2", "s1", 1), onHost("eps1", "s5", 2)] }),
    episode(2, { vostfr: [onHost("eps1", "s1", 1), onHost("eps3", "s1", 1)] }),
  ];
  assert.deepEqual(sourcesFor(season, "vostfr").map(choiceOf), ["s1", "s5"]);
});

test("a source with no host key is still chosen by its slot", () => {
  assert.equal(choiceOf({ ...source("eps4", 1), key: "" }), "eps4");
});
