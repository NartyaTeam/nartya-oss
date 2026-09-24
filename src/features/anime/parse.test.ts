import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fixElisions,
  parseAnimePage,
  parseEpisode,
  parseSeasonEpisodes,
  parseSkips,
} from "./parse.ts";

const page = {
  anime: {
    slug: "one-piece",
    title: "One Piece",
    synopsis: "Luffy part en mer.",
    status: "En cours",
    news: null,
    image: "https://img.example.test/one-piece.jpg",
    externalWatch: [{ host: "france.tv", url: "https://france.tv/one-piece" }],
  },
  anilist: {
    countryOfOrigin: "jp",
    genres: ["Action"],
    score: 8.7,
    year: 1999,
    format: "TV",
    episodes: 1122,
    description: "Un pirate.",
    descriptionLang: "fr",
    studios: ["Toei Animation"],
  },
  images: { fanart: "https://img.example.test/bg.jpg", clearLogo: null },
  seasons: [{ id: "saison1", name: "Saison 1" }],
};

const sealed = {
  episode: 1,
  title: "Le début",
  description: "Un départ.",
  image: "https://img.example.test/1.jpg",
  lecteurs: {
    vostfr: {
      eps1: { id: "token-a", key: "s1", label: "Source A", rank: 2 },
      eps2: { id: "token-b", key: "s2", label: "Source B", rank: 1, recommended: true },
    },
  },
};

test("keeps what the page reads, and drops the rest", () => {
  const read = parseAnimePage(page);
  assert.equal(read?.anime.slug, "one-piece");
  assert.equal(read?.anime.poster, "https://img.example.test/one-piece.jpg");
  assert.deepEqual(read?.anime.externalWatch, [
    { host: "france.tv", url: "https://france.tv/one-piece" },
  ]);
  assert.equal(read?.meta?.score, 8.7);
  assert.equal(read?.meta?.descriptionLang, "fr");
  assert.equal(read?.meta?.country, "JP");
  assert.equal(read?.images?.banner, null);
  assert.deepEqual(read?.seasons, [{ id: "saison1", name: "Saison 1" }]);
});

test("a page needs a slug and a title, the rest has defaults", () => {
  assert.equal(parseAnimePage({ anime: { slug: "x" } }), null);
  assert.equal(parseAnimePage({ anime: { title: "X" } }), null);
  assert.equal(parseAnimePage({}), null);

  const bare = parseAnimePage({ anime: { slug: "x", title: "X" } });
  assert.equal(bare?.meta, null);
  assert.equal(bare?.images, null);
  assert.deepEqual(bare?.seasons, []);
});

test("a description language the api did not promise is no language at all", () => {
  const page = { anime: { slug: "x", title: "X" }, anilist: { descriptionLang: "de" } };
  assert.equal(parseAnimePage(page)?.meta?.descriptionLang, null);
});

test("sources come out sorted by rank, carrying their slot", () => {
  const episode = parseEpisode(sealed);
  assert.deepEqual(
    episode?.sources["vostfr"]?.map((source) => source.slot),
    ["eps2", "eps1"],
  );
  assert.equal(episode?.sources["vostfr"]?.[0]?.recommended, true);
  assert.equal(episode?.sources["vostfr"]?.[1]?.recommended, false);
});

test("a legacy answer, whose sources are plain host urls, is not readable", () => {
  const legacy = { episode: 1, lecteurs: { vostfr: { eps1: "https://host.example.test/e1" } } };
  assert.equal(parseEpisode(legacy), null);
});

test("an episode with no source at all is not an episode", () => {
  assert.equal(parseEpisode({ episode: 1, lecteurs: {} }), null);
  assert.equal(parseEpisode({ title: "Sans numéro", lecteurs: sealed.lecteurs }), null);
});

test("one broken episode does not take its season down", () => {
  const season = parseSeasonEpisodes({
    seasonName: "Saison 1",
    episodes: [sealed, { title: "cassé" }, { ...sealed, episode: 2 }],
  });
  assert.deepEqual(
    season.episodes.map((episode) => episode.number),
    [1, 2],
  );
});

test("a season synopsis the api withheld leaves the card's own in place", () => {
  const season = parseSeasonEpisodes({ seasonName: "Saison 2", seasonDescription: null });
  assert.equal(season.description, null);
  assert.equal(season.name, "Saison 2");
});

test("a named special keeps its title rather than a number", () => {
  const special = parseEpisode({ ...sealed, title: "OAV spécial", isSpecial: true });
  assert.equal(special?.shown, "SP");
  assert.equal(special?.title, "OAV spécial");
});

test("an episode without a title falls back to its number", () => {
  assert.equal(parseEpisode({ ...sealed, title: "" })?.title, "Épisode 1");
});

test("the space some snapshots left after an apostrophe is closed up", () => {
  assert.equal(fixElisions("Le pays d' ogre"), "Le pays d'ogre");
  assert.equal(fixElisions("L’île"), "L'île");
  assert.equal(parseEpisode({ ...sealed, title: "L' île" })?.title, "L'île");
});

test("a source with no slot name has no handle, so it is dropped", () => {
  const nameless = {
    episode: 1,
    lecteurs: { vostfr: { "": { id: "token-a", key: "s1", label: "Source A", rank: 1 } } },
  };
  assert.equal(parseEpisode(nameless), null);
});

test("skip segments keep what makes sense, and nothing at all is null", () => {
  assert.deepEqual(parseSkips({ intro: { start: 90, end: 180 }, outro: null }), {
    intro: { start: 90, end: 180 },
    outro: null,
  });
  assert.deepEqual(
    parseSkips({ intro: { start: 90, end: 80 }, outro: { start: 1300, end: 1390 } }),
    {
      intro: null,
      outro: { start: 1300, end: 1390 },
    },
  );
  assert.equal(parseSkips({ intro: { start: "90", end: 180 } }), null);
  assert.equal(parseSkips(null), null);
});

test("films take their own name and their place, never the series' episodes", () => {
  const films = parseSeasonEpisodes({
    seasonName: "Films",
    episodes: [
      { ...sealed, episode: 0.001, title: "Je suis Luffy !", label: "Le Film", isSpecial: true },
      { ...sealed, episode: 1.002, title: "Zoro", description: "Kobby…", thumbnail: "t.jpg" },
    ],
  });
  assert.deepEqual(
    films.episodes.map(({ number, shown, title, description, thumbnail }) => ({
      number,
      shown,
      title,
      description,
      thumbnail,
    })),
    [
      { number: 0.001, shown: "1", title: "Le Film", description: null, thumbnail: null },
      { number: 1.002, shown: "2", title: "Film 2", description: null, thumbnail: null },
    ],
  );
});

test("an OAV season without names counts its episodes", () => {
  const oav = parseSeasonEpisodes({ seasonName: "OAV", episodes: [{ ...sealed, title: "Autre" }] });
  assert.equal(oav.episodes[0]?.title, "Épisode 1");
});

test("an episode of a regular season keeps what the api found for it", () => {
  const season = parseSeasonEpisodes({ seasonName: "Saison 1", episodes: [sealed] });
  assert.equal(season.episodes[0]?.shown, "1");
  assert.equal(season.episodes[0]?.title, sealed.title);
});

test("a side season is not dressed in the series' episodes either", () => {
  const log = parseSeasonEpisodes({
    seasonName: "One Piece Log: Fish-Man Island Saga",
    episodes: [{ ...sealed, title: "Je suis Luffy !" }],
  });
  assert.equal(log.episodes[0]?.title, "Épisode 1");
  assert.equal(log.episodes[0]?.description, null);
});
