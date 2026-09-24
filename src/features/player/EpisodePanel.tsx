import { ChevronLeft, ImageOff, Loader2, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Anime } from "../anime/anime.ts";
import { groupSeasons } from "../anime/season-groups.ts";
import type { Season } from "../anime/types.ts";
import type { ResourceStore } from "../../lib/resource-store.ts";
import { useResource } from "../../lib/use-resource.ts";
import type { Watched } from "./progress.ts";

type EpisodePanelProps = {
  anime: Anime;
  store: ResourceStore;
  slug: string;
  title: string;
  seasons: Season[];
  seasonId: string;
  episodeNumber: number;
  cover: string | null;
  watched: Record<string, Watched>;
  onPick: (seasonId: string, episodeNumber: number) => void;
  onHover: (hovered: boolean) => void;
};

export function EpisodePanel({
  anime,
  store,
  slug,
  title,
  seasons,
  seasonId,
  episodeNumber,
  cover,
  watched,
  onPick,
  onHover,
}: EpisodePanelProps) {
  const [viewed, setViewed] = useState(seasonId);
  const [choosingSeason, setChoosingSeason] = useState(false);
  const [open, setOpen] = useState<number | null>(episodeNumber);

  // Same key as the anime page: a season already opened there shows at once.
  const list = useResource(
    store,
    `episodes:${slug}:${viewed}`,
    () => anime.episodes(slug, viewed),
    {
      persist: true,
    },
  );
  const episodes = (list.data?.episodes ?? []).filter((episode) =>
    Object.values(episode.sources).some((sources) => sources.length > 0),
  );
  const season = seasons.find((entry) => entry.id === viewed);
  const playingRow = useRef<HTMLDivElement>(null);
  const shown = episodes.length > 0;

  // Opens on the episode being watched, however far into the season it is.
  useEffect(() => {
    playingRow.current?.scrollIntoView({ block: "center" });
  }, [shown, viewed]);
  const several = seasons.length > 1;
  const groups = groupSeasons(seasons);

  return (
    <div
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className="pointer-events-auto absolute bottom-16 right-3 flex h-[min(620px,calc(100%-6rem))] w-[min(720px,calc(100%-1.5rem))] animate-fade-in flex-col overflow-hidden rounded-md border border-white/10 bg-[#0e0e0e]/95 text-white shadow-2xl backdrop-blur-md"
    >
      {choosingSeason ? (
        <p className="truncate border-b border-white/10 px-6 py-4 text-xl font-bold">{title}</p>
      ) : (
        <button
          type="button"
          disabled={!several}
          onClick={() => {
            setChoosingSeason(true);
            setOpen(null);
          }}
          className="flex items-center gap-2.5 border-b border-white/10 px-6 py-4 text-left enabled:hover:bg-white/5"
        >
          {several && <ChevronLeft size={20} className="shrink-0 text-white/60" />}
          <span className="truncate text-xl font-bold">{season?.name ?? "Épisodes"}</span>
        </button>
      )}

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {choosingSeason ? (
          groups.map((group) => (
            <div key={group.label}>
              {groups.length > 1 && (
                <p className="select-none px-6 pb-2 pt-5 text-xs font-medium uppercase tracking-wider text-white/40">
                  {group.label}
                </p>
              )}
              {group.seasons.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setViewed(entry.id);
                    setChoosingSeason(false);
                    setOpen(null);
                  }}
                  className={`relative flex w-full items-center border-b border-white/5 px-6 py-5 text-left text-lg font-semibold hover:bg-white/10 ${entry.id === viewed ? "bg-white/5" : ""}`}
                >
                  {entry.id === seasonId && (
                    <span className="absolute inset-y-0 left-0 w-1 bg-primary" />
                  )}
                  {entry.name}
                </button>
              ))}
            </div>
          ))
        ) : list.loading && episodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-white/60">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-sm">Chargement des épisodes…</span>
          </div>
        ) : episodes.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-white/50">
            {list.error ?? "Aucun épisode disponible."}
          </p>
        ) : (
          episodes.map((episode) => {
            const seen = watched[`${viewed}:${String(episode.number)}`];
            const playing = viewed === seasonId && episode.number === episodeNumber;
            const expanded = open === episode.number;
            const image = episode.thumbnail ?? cover;
            return (
              <div
                key={episode.number}
                ref={playing ? playingRow : undefined}
                className={expanded ? "bg-white/[0.07] ring-1 ring-inset ring-white/70" : ""}
              >
                <button
                  type="button"
                  onClick={() =>
                    expanded ? onPick(viewed, episode.number) : setOpen(episode.number)
                  }
                  className={`flex w-full items-center gap-6 px-7 py-6 text-left ${expanded ? "pb-4" : "hover:bg-white/5"}`}
                >
                  <span className="min-w-[1.25em] shrink-0 text-center text-xl font-bold tabular-nums text-white/80">
                    {episode.number}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-lg font-semibold">
                    {episode.title || `Épisode ${String(episode.number)}`}
                  </span>
                  {playing && !expanded && (
                    <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-primary">
                      En cours
                    </span>
                  )}
                  <span className="h-[3px] w-28 shrink-0 overflow-hidden bg-white/25">
                    <span
                      className={`block h-full ${seen?.completed ? "bg-white/70" : "bg-primary"}`}
                      style={{ width: `${String(seen?.percent ?? 0)}%` }}
                    />
                  </span>
                </button>

                {expanded && (
                  <button
                    type="button"
                    onClick={() => onPick(viewed, episode.number)}
                    className="flex w-full gap-6 px-7 pb-7 text-left"
                  >
                    <span className="group relative ml-[calc(1.25em+1.5rem)] aspect-video w-52 shrink-0 overflow-hidden rounded-sm bg-surface-2">
                      {image ? (
                        <img src={image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-white/40">
                          <ImageOff size={20} />
                        </span>
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/15">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/80 bg-white/25 transition-transform group-hover:scale-110">
                          <Play size={22} className="ml-0.5 fill-current" />
                        </span>
                      </span>
                      {playing && (
                        <span className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-[0.7rem] font-bold uppercase tracking-wider">
                          Lecture en cours
                        </span>
                      )}
                    </span>
                    <span className="line-clamp-5 flex-1 text-[0.95rem] leading-relaxed text-white/80">
                      {episode.description ?? "Aucune description disponible."}
                    </span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
