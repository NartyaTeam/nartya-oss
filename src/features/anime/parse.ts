import type {
  AnimeDetail,
  AnimeMeta,
  AnimePage,
  Artwork,
  Broadcaster,
  Episode,
  Season,
  SeasonEpisodes,
  Segment,
  Skips,
  Source,
} from "./types.ts";

type Bag = Record<string, unknown>;

const bagOf = (value: unknown): Bag | null =>
  typeof value === "object" && value !== null ? (value as Bag) : null;

const text = (value: unknown): string => (typeof value === "string" ? value : "");

const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

// Episode snapshots still carry metadata where a space follows the apostrophe: "d' ogre".
// Fixed where the answer enters, so the page and the player read the same title.
export function fixElisions(value: string): string {
  return value
    .replace(/(^|[^\p{L}])(l|d|n|j|c|m|t|s|qu)['’`]\s+(?=\p{L})/giu, "$1$2'")
    .replace(/’/gu, "'");
}

const sentence = (value: unknown): string | null => {
  const raw = text(value).trim();
  return raw ? fixElisions(raw) : null;
};

function parseBroadcasters(value: unknown): Broadcaster[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const bag = bagOf(entry);
    const host = text(bag?.["host"]);
    const url = text(bag?.["url"]);
    return host && url ? [{ host, url }] : [];
  });
}

function parseDetail(value: unknown): AnimeDetail | null {
  const bag = bagOf(value);
  const slug = text(bag?.["slug"]);
  const title = text(bag?.["title"]);
  if (!bag || !slug || !title) return null;

  return {
    slug,
    title,
    alternativeTitles: strings(bag["alternativeTitles"]),
    synopsis: sentence(bag["synopsis"]),
    status: text(bag["status"]) || null,
    news: sentence(bag["news"]),
    poster: text(bag["image"]) || null,
    externalWatch: parseBroadcasters(bag["externalWatch"]),
  };
}

function parseMeta(value: unknown): AnimeMeta | null {
  const bag = bagOf(value);
  if (!bag) return null;

  const lang = text(bag["descriptionLang"]);
  return {
    titleNative: text(bag["titleNative"]) || null,
    country: text(bag["countryOfOrigin"]).toUpperCase() || null,
    genres: strings(bag["genres"]),
    score: count(bag["score"]),
    year: count(bag["year"]),
    format: text(bag["format"]) || null,
    status: text(bag["status"]) || null,
    episodes: count(bag["episodes"]),
    description: sentence(bag["description"]),
    descriptionLang: lang === "fr" || lang === "en" ? lang : null,
    studios: strings(bag["studios"]),
  };
}

function parseArtwork(value: unknown): Artwork | null {
  const bag = bagOf(value);
  if (!bag) return null;

  return {
    fanart: text(bag["fanart"]) || null,
    banner: text(bag["banner"]) || null,
    poster: text(bag["poster"]) || null,
    clearLogo: text(bag["clearLogo"]) || null,
  };
}

function parseSeasons(value: unknown): Season[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const bag = bagOf(entry);
    const id = text(bag?.["id"]);
    return id ? [{ id, name: text(bag?.["name"]) || id }] : [];
  });
}

export function parseAnimePage(value: unknown): AnimePage | null {
  const bag = bagOf(value);
  const anime = parseDetail(bag?.["anime"]);
  if (!bag || !anime) return null;

  return {
    anime,
    meta: parseMeta(bag["anilist"]),
    images: parseArtwork(bag["images"]),
    seasons: parseSeasons(bag["seasons"]),
  };
}

function parseSources(value: unknown): Record<string, Source[]> {
  const byLang = bagOf(value);
  if (!byLang) return {};

  const out: Record<string, Source[]> = {};
  for (const [lang, slots] of Object.entries(byLang)) {
    const bag = bagOf(slots);
    if (!bag) continue;

    const sources: Source[] = [];
    for (const [slot, entry] of Object.entries(bag)) {
      const source = bagOf(entry);
      const id = text(source?.["id"]);
      // The slot names the source in the url and in the menu: a blank one has no handle.
      if (!slot) continue;
      // A legacy answer carries the host url as a plain string here, and this client has
      // nothing left to make sense of one.
      if (!id) continue;
      sources.push({
        id,
        key: text(source?.["key"]),
        label: text(source?.["label"]) || slot,
        rank: count(source?.["rank"]) ?? Number.MAX_SAFE_INTEGER,
        recommended: source?.["recommended"] === true,
        slot,
      });
    }

    if (sources.length > 0) out[lang] = sources.sort((a, b) => a.rank - b.rank);
  }
  return out;
}

// One malformed episode must not blank its season, so parsing drops what it cannot read.
export function parseEpisode(value: unknown): Episode | null {
  const bag = bagOf(value);
  const number = count(bag?.["episode"]) ?? count(bag?.["number"]);
  if (!bag || number === null) return null;

  const sources = parseSources(bag["lecteurs"]);
  if (Object.keys(sources).length === 0) return null;

  return {
    number,
    title: sentence(bag["title"]) ?? `Épisode ${String(number)}`,
    description: sentence(bag["description"]),
    thumbnail: text(bag["thumbnail"]) || text(bag["image"]) || null,
    airDate: text(bag["airDate"]) || null,
    length: count(bag["length"]),
    special: bag["isSpecial"] === true,
    sources,
  };
}

export function parseSeasonEpisodes(value: unknown): SeasonEpisodes {
  const bag = bagOf(value);
  const episodes = Array.isArray(bag?.["episodes"])
    ? bag["episodes"].flatMap((entry) => {
        const episode = parseEpisode(entry);
        return episode ? [episode] : [];
      })
    : [];

  return {
    name: text(bag?.["seasonName"]) || null,
    // The api sends this only when it is french; the page prefers it over the card's own
    // synopsis, and an english one made the page switch language as the season loaded.
    description: sentence(bag?.["seasonDescription"]),
    cover: text(bag?.["seasonCover"]) || null,
    episodes,
  };
}

function parseSegment(value: unknown): Segment | null {
  const bag = bagOf(value);
  const start = count(bag?.["start"]);
  const end = count(bag?.["end"]);
  return start !== null && end !== null && start >= 0 && end > start ? { start, end } : null;
}

export function parseSkips(value: unknown): Skips | null {
  const bag = bagOf(value);
  const intro = parseSegment(bag?.["intro"]);
  const outro = parseSegment(bag?.["outro"]);
  return intro || outro ? { intro, outro } : null;
}
