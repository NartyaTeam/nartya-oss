import { useParams } from "react-router-dom";
import type { Anime } from "../features/anime/anime.ts";
import { AnimeHeader } from "../features/anime/ui/AnimeHeader.tsx";
import type { ResourceStore } from "../lib/resource-store.ts";
import { useResource } from "../lib/use-resource.ts";
import { Empty } from "../ui/Empty.tsx";

type AnimeProps = { anime: Anime; store: ResourceStore };

export function AnimePage({ anime, store }: AnimeProps) {
  const { slug = "" } = useParams();
  const { data, loading, error, outdated, reload } = useResource(
    store,
    `anime:${slug}`,
    () => anime.page(slug),
    { persist: true },
  );

  if (!data && loading) {
    return (
      <div className="pb-16">
        <div className="skeleton h-[300px] w-full md:h-[380px]" />
        <div className="relative z-10 -mt-44 flex gap-8 px-4 md:px-14">
          <div className="skeleton aspect-[2/3] w-44 shrink-0 rounded-lg md:w-52" />
          <div className="flex-1 pt-2 md:pt-28">
            <div className="skeleton h-12 w-80 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 pt-24 sm:px-8">
        <Empty
          title={outdated ? "Version trop ancienne" : "Fiche indisponible"}
          note={error ?? "Cette fiche est introuvable."}
          onRetry={outdated ? undefined : reload}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-16">
      <AnimeHeader page={data} seasonCover={null} seasonSynopsis={null} />
      {error && <p className="mt-8 text-center text-xs text-muted/70">{error}</p>}
    </div>
  );
}
