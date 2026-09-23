import { ArrowLeft, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { Anime } from "../features/anime/anime.ts";
import { DEFAULT_LANGUAGE, languageLabel, pickLanguage } from "../features/anime/languages.ts";
import { availableLanguages, episodesIn } from "../features/anime/season.ts";
import type { SeasonEpisodes } from "../features/anime/types.ts";
import { AUTO_SOURCE } from "../features/anime/ui/SeasonPicker.tsx";
import { Player } from "../features/player/Player.tsx";
import { episodeKey, type Progress, type SaveWhat } from "../features/player/progress.ts";
import { settleStart, type StartAt } from "../features/player/resume.ts";
import { useEpisodeStream } from "../features/player/useEpisodeStream.ts";
import type { ApiResult } from "../lib/api.ts";
import type { ResourceStore } from "../lib/resource-store.ts";
import { useResource } from "../lib/use-resource.ts";
import { Button } from "../ui/Button.tsx";
import { Empty } from "../ui/Empty.tsx";

const NO_SEASON: SeasonEpisodes = { name: null, description: null, cover: null, episodes: [] };

type WatchProps = { anime: Anime; store: ResourceStore; progress: Progress; userId: string };

export function WatchPage({ anime, store, progress, userId }: WatchProps) {
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

  const all = list.data?.episodes ?? [];
  const lang = pickLanguage(availableLanguages(all), params.get("lang") ?? DEFAULT_LANGUAGE);
  const playable = episodesIn(all, lang);
  const asked = Number(params.get("ep"));
  const index = Math.max(
    0,
    playable.findIndex((entry) => entry.number === asked),
  );
  const episode = playable[index];
  const next = playable[index + 1];

  const watchKey = episodeKey(slug, season?.id ?? "", episode?.number ?? 0, lang);
  // Read fresh every time rather than through the resource cache: leaving an episode and
  // coming straight back would otherwise resume at the position from before the watch.
  const [resume, setResume] = useState<StartAt | null>(null);
  useEffect(() => {
    let live = true;
    void progress.positionFor(userId, watchKey).then((seconds) => {
      if (live) setResume((held) => settleStart(held, watchKey, seconds));
    });
    return () => {
      live = false;
    };
  }, [progress, userId, watchKey]);
  // Unknown until the saved position is back: a player started before it begins at zero.
  const resumeAt = resume?.key === watchKey ? resume.seconds : null;

  const stream = useEpisodeStream(
    watchKey,
    episode?.sources[lang] ?? [],
    params.get("src") ?? AUTO_SOURCE,
    resumeAt ?? 0,
  );

  // What is saved rides on the report, not on the render: at cleanup the render already
  // describes the next episode, and the position just left would land under its key.
  const watching = useRef<SaveWhat | null>(null);
  const save = useRef<(force: boolean) => void>(() => undefined);
  save.current = (force) => {
    const what = watching.current;
    if (!what || what.duration <= 0) return;
    if (force) watching.current = null;
    void progress.save(userId, what, force);
  };

  useEffect(() => {
    const id = setInterval(() => save.current(false), 30_000);
    const onLeaving = (): void => save.current(true);
    window.addEventListener("pagehide", onLeaving);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", onLeaving);
      save.current(true);
    };
  }, [slug, season?.id, episode?.number, lang]);

  function goTo(number: number): void {
    save.current(true);
    const wanted = new URLSearchParams(params);
    wanted.set("ep", String(number));
    setParams(wanted, { replace: false });
  }

  if (!card.data || (list.loading && all.length === 0)) {
    return <div className="skeleton aspect-video w-full" />;
  }

  if (!episode || !season) {
    return (
      <div className="px-4 pt-24 sm:px-8">
        <Empty
          title="Épisode introuvable"
          note={list.error ?? "Cette saison n'a rien de disponible dans cette langue."}
          onRetry={list.error ? list.reload : undefined}
        />
      </div>
    );
  }

  const switchLanguage = (to: string): void => {
    const at = watching.current?.positionSeconds ?? 0;
    save.current(true);
    setResume({ key: episodeKey(slug, season.id, episode.number, to), seconds: at });
    const wanted = new URLSearchParams(params);
    wanted.set("lang", to);
    setParams(wanted, { replace: true });
  };

  const page = card.data;
  const title = page.anime.title;
  const back = `/anime/${encodeURIComponent(slug)}?saison=${encodeURIComponent(season.id)}&lang=${encodeURIComponent(lang)}`;

  return (
    <div className="animate-fade-in pb-16 pt-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
        <Link
          to={back}
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-text"
        >
          <ArrowLeft size={16} />
          {title}
        </Link>

        {stream.playable && resumeAt !== null ? (
          <Player
            source={{ url: stream.playable.url, isHls: stream.playable.isHls, host: stream.host }}
            poster={episode.thumbnail ?? page.images?.poster ?? null}
            startAt={stream.startAt}
            languages={Object.keys(episode.sources).filter(
              (entry) => (episode.sources[entry] ?? []).length > 0,
            )}
            language={lang}
            country={page.meta?.country ?? null}
            onLanguage={switchLanguage}
            onTime={(seconds, duration) => {
              watching.current = {
                slug,
                seasonId: season.id,
                episodeNumber: episode.number,
                language: lang,
                positionSeconds: seconds,
                duration,
                title: page.anime.title,
                cover: page.images?.poster ?? page.anime.poster,
              };
              stream.onTime(seconds);
            }}
            onEnded={() => {
              save.current(true);
              if (next) goTo(next.number);
            }}
            onError={stream.onFailed}
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-black text-sm text-muted">
            {stream.loading || stream.playable
              ? "Recherche d'une source…"
              : (stream.error ?? "Lecture impossible")}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-xl font-bold">
              {episode.number}. {episode.title}
            </h1>
            <p className="text-xs text-muted">
              {season.name} · {languageLabel(lang)}
            </p>
          </div>
          {!stream.loading && !stream.playable && (
            <Button variant="ghost" onClick={stream.retry}>
              Réessayer
            </Button>
          )}
          {next && (
            <Button onClick={() => goTo(next.number)}>
              <SkipForward size={16} />
              Épisode suivant
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
