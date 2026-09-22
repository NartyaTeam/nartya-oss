export type Artwork = {
  fanart: string | null;
  banner: string | null;
  poster: string | null;
  clearLogo: string | null;
};

export type Broadcaster = { host: string; url: string };

export type AnimeDetail = {
  slug: string;
  title: string;
  synopsis: string | null;
  status: string | null;
  news: string | null;
  poster: string | null;
  externalWatch: Broadcaster[];
};

export type AnimeMeta = {
  genres: string[];
  score: number | null;
  year: number | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  description: string | null;
  // The api says which language it managed to serve, so the page can flag an untranslated
  // synopsis instead of passing english off as french.
  descriptionLang: "fr" | "en" | null;
  studios: string[];
};

export type Season = { id: string; name: string };

export type AnimePage = {
  anime: AnimeDetail;
  meta: AnimeMeta | null;
  images: Artwork | null;
  seasons: Season[];
};

export type Source = {
  id: string;
  key: string;
  label: string;
  rank: number;
  recommended: boolean;
  // The api's own slot name, eps1 or eps2: it says nothing about the host, and it is what
  // a remembered choice or a disqualified source is keyed on.
  slot: string;
};

export type Episode = {
  number: number;
  title: string;
  description: string | null;
  thumbnail: string | null;
  airDate: string | null;
  length: number | null;
  special: boolean;
  sources: Record<string, Source[]>;
};

export type SeasonEpisodes = {
  name: string | null;
  description: string | null;
  cover: string | null;
  episodes: Episode[];
};
