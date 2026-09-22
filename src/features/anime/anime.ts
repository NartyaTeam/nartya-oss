import type { Api, ApiResult } from "../../lib/api.ts";
import { parseAnimePage, parseSeasonEpisodes } from "./parse.ts";
import type { AnimePage, SeasonEpisodes } from "./types.ts";

const NOT_FOUND = "Cette fiche est introuvable.";

export function createAnime(api: Api) {
  return {
    page: async (slug: string): Promise<ApiResult<AnimePage>> => {
      const answer = await api.get<unknown>(`/anime/${encodeURIComponent(slug)}/page`);
      if (!answer.ok) return answer;
      const page = parseAnimePage(answer.data);
      return page ? { ok: true, data: page } : { ok: false, outdated: false, message: NOT_FOUND };
    },

    // Sources are asked for sealed: the answer carries stream tokens, never a host url.
    episodes: async (slug: string, seasonId: string): Promise<ApiResult<SeasonEpisodes>> => {
      const answer = await api.get<unknown>(
        `/anime/${encodeURIComponent(slug)}/seasons/${encodeURIComponent(seasonId)}/episodes?sources=v2`,
      );
      return answer.ok ? { ok: true, data: parseSeasonEpisodes(answer.data) } : answer;
    },
  };
}

export type Anime = ReturnType<typeof createAnime>;
