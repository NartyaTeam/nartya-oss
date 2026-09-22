export type AnimeCard = {
  id: string;
  slug: string;
  title: string;
  cover: string;
  score: number | null;
  genres: string[];
  langs: string[];
};

export type HeroItem = AnimeCard & {
  fanart: string | null;
  clearLogo: string | null;
  description: string | null;
};

export type RowVariant = "plain" | "numbered" | "episode";

export type Row = {
  key: string;
  title: string;
  kana: string | null;
  variant: RowVariant;
  items: AnimeCard[];
};

export type HomeSections = { hero: HeroItem[]; rows: Row[] };

export type GenreCard = { genre: string; image: string };

export type SearchFilters = {
  search: string;
  genres: string[];
  type: string;
  lang: string;
  page: number;
};

export type SearchResults = { items: AnimeCard[]; hasMore: boolean };
