import { useParams, useSearchParams } from "react-router-dom";
import type { Anime } from "../features/anime/anime.ts";
import { DEFAULT_LANGUAGE, pickLanguage } from "../features/anime/languages.ts";
import { availableLanguages } from "../features/anime/season.ts";
import type { SeasonEpisodes } from "../features/anime/types.ts";
import { AnimeHeader } from "../features/anime/ui/AnimeHeader.tsx";
import { SeasonsSection } from "../features/anime/ui/SeasonsSection.tsx";
import { AUTO_SOURCE } from "../features/anime/ui/SeasonPicker.tsx";
import type { ApiResult } from "../lib/api.ts";
import type { ResourceStore } from "../lib/resource-store.ts";
import { useResource } from "../lib/use-resource.ts";
import { Empty } from "../ui/Empty.tsx";

const NO_SEASON: SeasonEpisodes = { name: null, description: null, cover: null, episodes: [] };

type AnimeProps = { anime: Anime; store: ResourceStore };

function Skeleton() {
  return (
    <div className="pb-16">
      <div className="skeleton h-[300px] w-full md:h-[380px]" />
      <div className="relative z-10 -mt-44 flex gap-8 px-4 md:px-14">
        <div className="skeleton aspect-[2/3] w-44 shrink-0 self-start rounded-lg md:w-52" />
        <div className="flex-1 pt-2 md:pt-28">
          <div className="skeleton h-12 w-80 rounded" />
        </div>
      </div>
    </div>
  );
}

export function AnimePage({ anime, store }: AnimeProps) {
  const { slug = "" } = useParams();
  const [params, setParams] = useSearchParams();

  const card = useResource(store, `anime:${slug}`, () => anime.page(slug), { persist: true });

  const seasons = card.data?.seasons ?? [];
  const season = seasons.find((entry) => entry.id === params.get("saison")) ?? seasons[0];

  const list = useResource(
    store,
    `episodes:${slug}:${season?.id ?? ""}`,
    (): Promise<ApiResult<SeasonEpisodes>> =>
      season ? anime.episodes(slug, season.id) : Promise.resolve({ ok: true, data: NO_SEASON }),
    { persist: true },
  );

  const episodes = list.data?.episodes ?? [];
  const lang = pickLanguage(availableLanguages(episodes), params.get("lang") ?? DEFAULT_LANGUAGE);

  // The choice travels in the url, so coming back from the player restores it. A language
  // is kept across seasons: pickLanguage decides whether the next one carries it.
  function choose(patch: Record<string, string>): void {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) next.set(key, value);
    setParams(next, { replace: true });
  }

  if (!card.data && card.loading) return <Skeleton />;

  if (!card.data) {
    return (
      <div className="px-4 pt-24 sm:px-8">
        <Empty
          title={card.outdated ? "Version trop ancienne" : "Fiche indisponible"}
          note={card.error ?? "Cette fiche est introuvable."}
          onRetry={card.outdated ? undefined : card.reload}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-16">
      <AnimeHeader
        page={card.data}
        seasonCover={list.data?.cover ?? null}
        seasonSynopsis={list.data?.description ?? null}
      />
      {season && (
        <SeasonsSection
          page={card.data}
          seasonId={season.id}
          episodes={episodes}
          lang={lang}
          source={params.get("src") ?? AUTO_SOURCE}
          loading={list.loading}
          error={list.error}
          onChoose={choose}
          onRetry={list.reload}
        />
      )}
    </div>
  );
}
