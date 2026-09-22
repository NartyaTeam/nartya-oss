import type { Api, ApiResult } from "../../lib/api.ts";
import { parseCards, parseGenreCards, parseHome } from "./parse.ts";
import type { AnimeCard, GenreCard, HomeSections, SearchFilters, SearchResults } from "./types.ts";

// The api answers a full page or the end of the list; it does not say which. Mirrors
// CATALOG_PAGE_SIZE on its side.
export const PAGE_SIZE = 36;

export function searchQuery(filters: SearchFilters): string {
  const params = new URLSearchParams();
  const search = filters.search.trim();
  if (search) params.set("search", search);
  if (filters.genres.length > 0) params.set("genre", filters.genres.join(","));
  if (filters.type) params.set("type", filters.type);
  if (filters.lang) params.set("lang", filters.lang);
  params.set("page", String(Math.max(1, filters.page)));
  return params.toString();
}

export function createCatalog(api: Api) {
  async function read<T>(path: string, parse: (value: unknown) => T): Promise<ApiResult<T>> {
    const answer = await api.get<unknown>(path);
    return answer.ok ? { ok: true, data: parse(answer.data) } : answer;
  }

  function paged(cards: AnimeCard[]): SearchResults {
    return { items: cards, hasMore: cards.length >= PAGE_SIZE };
  }

  return {
    home: (): Promise<ApiResult<HomeSections>> => read("/home/sections", parseHome),

    genres: (): Promise<ApiResult<GenreCard[]>> => read("/anime/genres/cards", parseGenreCards),

    byGenre: (genre: string, page: number): Promise<ApiResult<SearchResults>> =>
      read(`/anime/genre/${encodeURIComponent(genre)}?page=${String(Math.max(1, page))}`, (value) =>
        paged(parseCards(value)),
      ),

    search: (filters: SearchFilters): Promise<ApiResult<SearchResults>> =>
      read(`/anime/catalog?${searchQuery(filters)}`, (value) => paged(parseCards(value))),
  };
}

export type Catalog = ReturnType<typeof createCatalog>;
