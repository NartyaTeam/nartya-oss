import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Anime } from "../features/anime/anime.ts";
import { DEFAULT_LANGUAGE, pickLanguage } from "../features/anime/languages.ts";
import { availableLanguages, episodesIn } from "../features/anime/season.ts";
import type { SeasonEpisodes } from "../features/anime/types.ts";
import { AUTO_SOURCE } from "../features/anime/ui/SeasonPicker.tsx";
import { offlineCopy } from "../features/downloads/library.ts";
import { useDownloads } from "../features/downloads/store.ts";
import { episodeLabel, seasonNumber } from "../features/player/episode-label.ts";
import { BackButton } from "../features/player/BackButton.tsx";
import { CreditsControls } from "../features/player/CreditsControls.tsx";
import { EpisodePanel } from "../features/player/EpisodePanel.tsx";
import { NextPreview } from "../features/player/NextPreview.tsx";
import { OfflinePlayer } from "../features/player/OfflinePlayer.tsx";
import { usePresence } from "../features/presence/usePresence.ts";
import { Player } from "../features/player/Player.tsx";
import { PlayerStatus } from "../features/player/PlayerStatus.tsx";
import { episodeKey, type Progress } from "../features/player/progress.ts";
import { useProgressSaver } from "../features/player/useProgressSaver.ts";
import { settleStart, type StartAt } from "../features/player/resume.ts";
import { useCredits } from "../features/player/useCredits.ts";
import { useEpisodeStream } from "../features/player/useEpisodeStream.ts";
import type { ApiResult } from "../lib/api.ts";
import type { ResourceStore } from "../lib/resource-store.ts";
import { useResource } from "../lib/use-resource.ts";
import { firstSeason } from "../features/anime/season-groups.ts";
import { downloadId } from "../../shared/downloads.ts";

// Lets the pointer cross the gap between the button and the panel.
const PANEL_CLOSE_DELAY_MS = 120;

const NO_SEASON: SeasonEpisodes = { name: null, description: null, cover: null, episodes: [] };

type WatchProps = { anime: Anime; store: ResourceStore; progress: Progress; userId: string };

export function WatchPage({ anime, store, progress, userId }: WatchProps) {
  const { slug = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const asked = Number(params.get("ep"));
  const requested = useDownloads(
    (state) =>
      state.items[downloadId(slug, params.get("saison") ?? "", asked, params.get("lang") ?? "")],
  );

  const card = useResource(store, `anime:${slug}`, () => anime.page(slug), { persist: true });
  const seasons = card.data?.seasons ?? [];
  const season = seasons.find((entry) => entry.id === params.get("saison")) ?? firstSeason(seasons);

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

  const downloaded = useDownloads(
    (state) => state.items[downloadId(slug, season?.id ?? "", episode?.number ?? 0, lang)],
  );
  const stream = useEpisodeStream(
    watchKey,
    offlineCopy(downloaded),
    episode?.sources[lang] ?? [],
    params.get("src") ?? AUTO_SOURCE,
    resumeAt ?? 0,
  );

  const { watching, save } = useProgressSaver(progress, userId, watchKey);

  const seasonIndex = season ? seasons.indexOf(season) : 0;
  const skipsKey = `skips:${slug}:${season?.id ?? ""}:${String(episode?.number ?? 0)}`;
  const skips = useResource(store, skipsKey, () =>
    season && episode
      ? anime.skips(slug, season.id, episode.number, seasonNumber(season.name, seasonIndex))
      : Promise.resolve({ ok: true as const, data: null }),
  );
  const credits = useCredits(watchKey, skips.data);
  const seek = useRef<(seconds: number) => void>(() => undefined);

  const seen = useResource(store, `watched:${slug}:${userId}`, async () => ({
    ok: true as const,
    data: await progress.watchedIn(slug, userId),
  }));

  const [panel, setPanel] = useState(false);
  const [preview, setPreview] = useState(false);
  const closing = useRef<number | null>(null);
  const hoverPanel = (hovered: boolean): void => {
    if (closing.current !== null) window.clearTimeout(closing.current);
    closing.current = null;
    if (!hovered) {
      closing.current = window.setTimeout(() => setPanel(false), PANEL_CLOSE_DELAY_MS);
      return;
    }
    // What was watched moves while the player runs: the cached read is already behind.
    if (!panel) seen.reload();
    setPanel(true);
  };

  function goTo(number: number, seasonId?: string): void {
    save(true);
    const wanted = new URLSearchParams(params);
    if (seasonId) wanted.set("saison", seasonId);
    wanted.set("ep", String(number));
    // Replaced, so that leaving the player goes back to where it was opened from.
    setParams(wanted, { replace: true });
  }

  const page = card.data;
  const offline = requested?.type === "episode" && requested.status === "done" ? requested : null;
  usePresence(
    page && season && episode
      ? {
          kind: "watching",
          slug,
          title: page.anime.title,
          episode: episode.number,
          season: seasonNumber(season.name, seasonIndex),
        }
      : offline && {
          kind: "watching",
          slug,
          title: offline.animeTitle,
          episode: offline.ep,
          season: seasonNumber(offline.seasonName ?? "", 0),
        },
  );
  const leave = (): void => {
    const state: unknown = window.history.state;
    const depth = typeof state === "object" && state !== null ? Reflect.get(state, "idx") : 0;
    if (typeof depth === "number" && depth > 0) navigate(-1);
    else navigate(`/anime/${encodeURIComponent(slug)}`, { replace: true });
  };

  // The api out of reach, from no network or its own failure: a download still plays.
  const stranded = (!page && card.error !== null) || (list.error !== null && all.length === 0);
  if (stranded && offline) {
    return (
      <OfflinePlayer
        item={offline}
        progress={progress}
        userId={userId}
        onLeave={leave}
        onPick={(next) => goTo(next.ep, next.seasonId)}
      />
    );
  }

  if (!page) {
    return (
      <div className="fixed inset-0 bg-black">
        <BackButton onClick={leave} shown />
        {card.error ? (
          <PlayerStatus note={card.error} onRetry={card.reload} />
        ) : (
          <PlayerStatus note="Chargement…" busy />
        )}
      </div>
    );
  }

  const switchLanguage = (to: string): void => {
    if (!season || !episode) return;
    const at = watching.current?.positionSeconds ?? 0;
    save(true);
    setResume({ key: episodeKey(slug, season.id, episode.number, to), seconds: at });
    const wanted = new URLSearchParams(params);
    wanted.set("lang", to);
    setParams(wanted, { replace: true });
  };

  const ready = stream.playable !== null && resumeAt !== null;
  const status = (() => {
    if (list.loading && all.length === 0) return <PlayerStatus note="Chargement…" busy />;
    if (!episode || !season) {
      return (
        <PlayerStatus
          note={list.error ?? "Cette saison n'a rien de disponible dans cette langue."}
          onRetry={list.error ? list.reload : undefined}
        />
      );
    }
    if (ready || stream.loading || stream.playable) return null;
    return <PlayerStatus note={stream.error ?? "Lecture impossible"} onRetry={stream.retry} />;
  })();

  return (
    <div className="fixed inset-0 bg-black">
      <Player
        source={
          ready && stream.playable
            ? {
                url: stream.playable.url,
                isHls: stream.playable.isHls,
                host: stream.host,
                local: stream.local,
              }
            : null
        }
        poster={episode?.thumbnail ?? page.images?.poster ?? null}
        startAt={stream.startAt}
        title={season && episode ? episodeLabel(season.name, seasonIndex, episode) : ""}
        hasNext={next !== undefined}
        onNext={() => {
          if (next) goTo(next.number);
        }}
        onNextHover={setPreview}
        onEpisodes={hoverPanel}
        hasEpisodes
        languages={
          episode
            ? Object.keys(episode.sources).filter(
                (entry) => (episode.sources[entry] ?? []).length > 0,
              )
            : []
        }
        language={lang}
        country={page.meta?.country ?? null}
        onLanguage={switchLanguage}
        onTime={(seconds, duration) => {
          if (!season || !episode) return;
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
          credits.report(seconds, duration);
        }}
        onEnded={() => {
          save(true);
          if (next && !credits.dismissed) goTo(next.number);
        }}
        onError={stream.onFailed}
        seek={seek}
      >
        <BackButton onClick={leave} shown={!ready} />
        {status}
        {ready && (
          <CreditsControls
            credits={credits.credits}
            countdown={credits.countdown}
            dismissed={credits.dismissed}
            hasNext={next !== undefined}
            onSkip={(to) => seek.current(to)}
            onNext={() => {
              if (next) goTo(next.number);
            }}
            onDismiss={credits.dismiss}
          />
        )}
        {preview && !panel && next && (
          <NextPreview
            episode={next}
            cover={page.images?.poster ?? page.anime.poster}
            onPlay={() => {
              setPreview(false);
              goTo(next.number);
            }}
          />
        )}
        {panel && season && (
          <EpisodePanel
            anime={anime}
            store={store}
            slug={slug}
            title={page.anime.title}
            seasons={seasons}
            seasonId={season.id}
            episodeNumber={episode?.number ?? 0}
            cover={page.images?.poster ?? page.anime.poster}
            watched={seen.data ?? {}}
            onPick={(seasonId, number) => {
              setPanel(false);
              goTo(number, seasonId);
            }}
            onHover={hoverPanel}
          />
        )}
      </Player>
    </div>
  );
}
