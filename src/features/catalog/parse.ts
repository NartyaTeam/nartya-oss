import type { AnimeCard, GenreCard, HeroItem, HomeSections, Row, RowVariant } from "./types.ts";

type Bag = Record<string, unknown>;

const bagOf = (value: unknown): Bag | null =>
  typeof value === "object" && value !== null ? (value as Bag) : null;

const text = (value: unknown): string => (typeof value === "string" ? value : "");

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

// One malformed item must not blank a whole row, so parsing drops what it cannot read
// rather than refusing the answer.
export function parseCard(value: unknown): AnimeCard | null {
  const bag = bagOf(value);
  const slug = text(bag?.["slug"]);
  const title = text(bag?.["title"]);
  if (!bag || !slug || !title) return null;

  return {
    id: text(bag["id"]) || slug,
    slug,
    title,
    cover: text(bag["cover"]),
    score: typeof bag["score"] === "number" ? bag["score"] : null,
    genres: strings(bag["genres"]),
    langs: strings(bag["langs"]),
  };
}

export function parseHero(value: unknown): HeroItem | null {
  const card = parseCard(value);
  const bag = bagOf(value);
  if (!card || !bag) return null;

  return {
    ...card,
    fanart: text(bag["fanart"]) || null,
    clearLogo: text(bag["clearLogo"]) || null,
    description: text(bag["description"]) || null,
  };
}

function variantOf(bag: Bag): RowVariant {
  if (bag["numbered"] === true) return "numbered";
  return bag["variant"] === "episode" ? "episode" : "plain";
}

export function parseRow(value: unknown): Row | null {
  const bag = bagOf(value);
  const key = text(bag?.["key"]);
  if (!bag || !key) return null;

  const items = Array.isArray(bag["items"])
    ? bag["items"].map(parseCard).filter((card): card is AnimeCard => card !== null)
    : [];
  if (items.length === 0) return null;

  return {
    key,
    title: text(bag["title"]),
    kana: text(bag["kana"]) || null,
    variant: variantOf(bag),
    items,
  };
}

export function parseHome(value: unknown): HomeSections {
  const bag = bagOf(value);
  const hero = Array.isArray(bag?.["hero"])
    ? bag["hero"].map(parseHero).filter((item): item is HeroItem => item !== null)
    : [];
  const rows = Array.isArray(bag?.["rows"])
    ? bag["rows"].map(parseRow).filter((row): row is Row => row !== null)
    : [];
  return { hero, rows };
}

export function parseGenreCards(value: unknown): GenreCard[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const bag = bagOf(entry);
      const genre = text(bag?.["genre"]);
      return genre ? { genre, image: text(bag?.["image"]) } : null;
    })
    .filter((card): card is GenreCard => card !== null);
}

export function parseCards(value: unknown): AnimeCard[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseCard).filter((card): card is AnimeCard => card !== null);
}
