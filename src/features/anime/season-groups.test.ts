import assert from "node:assert/strict";
import { test } from "node:test";
import { firstSeason, groupSeasons } from "./season-groups.ts";

const seasons = (...names: string[]) => names.map((name, i) => ({ id: String(i), name }));
const shape = (names: string[]) =>
  groupSeasons(seasons(...names)).map((group) => [
    group.label,
    group.seasons.map((season) => season.name),
  ]);

test("seasons, kai, films, specials and the rest each get their own group, in that order", () => {
  assert.deepEqual(shape(["OAV", "Films", "Fan Letter", "Kai", "Saison 2", "Saison 1"]), [
    ["Saisons", ["Saison 1", "Saison 2"]],
    ["Kai", ["Kai"]],
    ["Films", ["Films"]],
    ["OAV & spéciaux", ["OAV"]],
    ["Autres", ["Fan Letter"]],
  ]);
});

test("sagas sort by their number, not by the text", () => {
  assert.deepEqual(
    shape([
      "Saga 10 Pays des Wa [Episode 878 à 1088]",
      "Saga 1 East Blue [Episode 1 à 61]",
      "Kai - Saga 10 (Pays des Wa)",
      "Saga 2 Alabasta [Episode 62 à 143]",
      "Kai - Saga 2 (Alabasta)",
      "One Piece Log: Fish-Man Island Saga",
    ]),
    [
      [
        "Saisons",
        [
          "Saga 1 East Blue [Episode 1 à 61]",
          "Saga 2 Alabasta [Episode 62 à 143]",
          "Saga 10 Pays des Wa [Episode 878 à 1088]",
        ],
      ],
      ["Kai", ["Kai - Saga 2 (Alabasta)", "Kai - Saga 10 (Pays des Wa)"]],
      ["Autres", ["One Piece Log: Fish-Man Island Saga"]],
    ],
  );
});

test("only the number after the word counts, and ties keep the api's order", () => {
  assert.deepEqual(shape(["100 Years Quest Saison 1", "Saison 2", "Saison 1"]), [
    ["Saisons", ["100 Years Quest Saison 1", "Saison 1", "Saison 2"]],
  ]);
  assert.deepEqual(shape(["Saison 2", "Saison 1.5", "Saison 1", "Saison 1 Director's Cut"]), [
    ["Saisons", ["Saison 1", "Saison 1 Director's Cut", "Saison 1.5", "Saison 2"]],
  ]);
});

test("the cuts with and without fillers, parts and versions are the main series", () => {
  assert.deepEqual(
    shape([
      "Film",
      "Avec fillers",
      "Sans fillers",
      "Thousand-Year Blood War Partie 2",
      "Thousand-Year Blood War Partie 1",
      "Version 2011",
      "Version 1999",
    ]),
    [
      [
        "Saisons",
        [
          "Avec fillers",
          "Sans fillers",
          "Thousand-Year Blood War Partie 1",
          "Thousand-Year Blood War Partie 2",
          "Version 1999",
          "Version 2011",
        ],
      ],
      ["Films", ["Film"]],
    ],
  );
});

test("a film named after its title stays a film, and specials are recognised", () => {
  assert.deepEqual(shape(["Film - La Forteresse Infinie", "OAVs", "OAD", "Special"]), [
    ["Films", ["Film - La Forteresse Infinie"]],
    ["OAV & spéciaux", ["OAVs", "OAD", "Special"]],
  ]);
});

test("an anime opens on its first season, not on whatever the api lists first", () => {
  assert.equal(firstSeason(seasons("Films", "Kai", "Saison 2", "Saison 1"))?.name, "Saison 1");
  assert.equal(firstSeason(seasons("Films", "Kai"))?.name, "Kai");
  assert.equal(firstSeason([]), undefined);
});
