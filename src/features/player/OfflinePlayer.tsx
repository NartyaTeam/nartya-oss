import { useEffect, useRef, useState } from "react";
import type { EpisodeDownload } from "../../../shared/downloads.ts";
import { getPlatform } from "../../lib/platform.ts";
import { nextDownloaded, offlineCopy } from "../downloads/library.ts";
import { useDownloads } from "../downloads/store.ts";
import { useLocalImage } from "../downloads/useLocalImage.ts";
import { BackButton } from "./BackButton.tsx";
import { episodeLabel } from "./episode-label.ts";
import { openOffline } from "./offline-open.ts";
import { Player, type PlayerSource } from "./Player.tsx";
import { PlayerStatus } from "./PlayerStatus.tsx";
import { episodeKey, type Progress } from "./progress.ts";
import { useProgressSaver } from "./useProgressSaver.ts";

const MISSING = "Fichier hors ligne introuvable. Il a peut-être été supprimé.";
const FAILED = "La lecture du fichier hors ligne a échoué.";

type Opened = { key: string; source: PlayerSource | null; startAt: number; error: string | null };

type OfflinePlayerProps = {
  item: EpisodeDownload;
  progress: Progress;
  userId: string;
  onLeave: () => void;
  onPick: (next: EpisodeDownload) => void;
};

export function OfflinePlayer({ item, progress, userId, onLeave, onPick }: OfflinePlayerProps) {
  const key = episodeKey(item.slug, item.seasonId, item.ep, item.lang);
  const next = useDownloads((state) => nextDownloaded(Object.values(state.items), item));
  const poster = useLocalImage(item.id, item.thumbFile, item.epThumb ?? item.animeCover);
  const [opened, setOpened] = useState<Opened | null>(null);
  const current = opened?.key === key ? opened : null;

  // The record changes as its download is updated; only the episode opening matters here.
  const record = useRef(item);
  record.current = item;

  useEffect(() => {
    let live = true;
    const bridge = getPlatform()?.downloads;
    void openOffline(offlineCopy(record.current), {
      localUrl: (id, file) => (bridge ? bridge.localUrl(id, file) : Promise.resolve(null)),
      position: () => progress.positionFor(userId, key),
      wait: (ms) => new Promise((done) => setTimeout(done, ms)),
    }).then(({ source, startAt }) => {
      if (live) setOpened({ key, source, startAt, error: source ? null : MISSING });
    });
    return () => {
      live = false;
    };
  }, [key, progress, userId]);

  const { watching, save } = useProgressSaver(progress, userId, key);

  const goNext = (): void => {
    save(true);
    if (next) onPick(next);
  };

  const seek = useRef<(seconds: number) => void>(() => undefined);
  const title = episodeLabel(item.seasonName ?? "", 0, {
    shown: String(item.ep),
    title: item.epTitle ?? "",
  });

  return (
    <div className="fixed inset-0 bg-black">
      <Player
        source={current?.source ?? null}
        poster={poster}
        startAt={current?.startAt ?? 0}
        title={title}
        hasNext={next !== undefined}
        onNext={goNext}
        onNextHover={() => undefined}
        onEpisodes={() => undefined}
        hasEpisodes={false}
        languages={[]}
        language={item.lang}
        country={null}
        onLanguage={() => undefined}
        onTime={(seconds, duration) => {
          watching.current = {
            slug: item.slug,
            seasonId: item.seasonId,
            episodeNumber: item.ep,
            language: item.lang,
            positionSeconds: seconds,
            duration,
            title: item.animeTitle,
            cover: item.animeCover,
          };
        }}
        onEnded={goNext}
        onError={() => setOpened({ key, source: null, startAt: 0, error: FAILED })}
        seek={seek}
      >
        <BackButton onClick={onLeave} shown={!current?.source} />
        {!current && <PlayerStatus note="Chargement…" busy />}
        {current?.error && <PlayerStatus note={current.error} />}
      </Player>
    </div>
  );
}
