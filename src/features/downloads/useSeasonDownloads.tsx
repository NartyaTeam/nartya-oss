import { useState, type ReactNode } from "react";
import { downloadId, seasonPrefix, type DownloadItem } from "../../../shared/downloads.ts";
import { getPlatform } from "../../lib/platform.ts";
import type { AnimePage, Episode } from "../anime/types.ts";
import { DownloadButton } from "./DownloadButton.tsx";
import { downloadOrder } from "./prepare.ts";
import { useDownloads, type Job } from "./store.ts";

type Season = { page: AnimePage; seasonId: string; lang: string; source: string };

const BUSY: DownloadItem["status"][] = ["queued", "downloading", "processing"];

export function useSeasonDownloads({ page, seasonId, lang, source }: Season, episodes: Episode[]) {
  const { items, preparing, failed, start, cancel, remove, cancelSeason } = useDownloads();
  // A selection belongs to the season and language it was made in.
  const scope = `${seasonId}::${lang}`;
  const [picking, setPicking] = useState<{ scope: string; picked: Set<number> } | null>(null);
  const picked = picking?.scope === scope ? picking.picked : null;

  const slug = page.anime.slug;
  const seasonName = page.seasons.find((entry) => entry.id === seasonId)?.name ?? null;
  const idOf = (episode: Episode): string => downloadId(slug, seasonId, episode.number, lang);

  const jobFor = (episode: Episode): Job => ({
    details: {
      slug,
      seasonId,
      ep: episode.number,
      lang,
      animeTitle: page.anime.title,
      animeCover: page.images?.poster ?? page.anime.poster,
      epThumb: episode.thumbnail,
      epTitle: episode.title,
      seasonName,
    },
    sources: downloadOrder(episode.sources[lang] ?? [], source),
  });

  const remaining = episodes.filter((episode) => {
    const id = idOf(episode);
    const status = items[id]?.status;
    return !preparing[id] && status !== "done" && !(status && BUSY.includes(status));
  });
  const prefix = seasonPrefix(slug, seasonId);
  const active = [
    ...Object.keys(preparing),
    ...Object.values(items)
      .filter((item) => BUSY.includes(item.status))
      .map((item) => item.id),
  ].filter((id) => id.startsWith(prefix) && id.endsWith(`::${lang}`)).length;

  const action = (episode: Episode): ReactNode => {
    const id = idOf(episode);
    return (
      <DownloadButton
        item={items[id]}
        preparing={preparing[id] === true}
        failed={failed[id]}
        onStart={() => start([jobFor(episode)])}
        onCancel={() => cancel(id)}
        onRemove={() => remove(id)}
      />
    );
  };

  const toggle = (episode: Episode): void => {
    if (!picked) return;
    const next = new Set(picked);
    if (next.has(episode.number)) next.delete(episode.number);
    else next.add(episode.number);
    setPicking({ scope, picked: next });
  };

  const pickable = new Set(remaining.map((episode) => episode.number));
  const all = picked !== null && pickable.size > 0 && [...pickable].every((n) => picked.has(n));

  return {
    enabled: getPlatform() !== null,
    action,
    picked,
    toggle,
    controls: {
      remaining: remaining.length,
      active,
      picking: picked !== null,
      onAll: () => start(remaining.map(jobFor)),
      onTogglePicking: () => setPicking(picked ? null : { scope, picked: new Set() }),
      onCancelActive: () => cancelSeason(slug, seasonId, lang),
    },
    pickBar: {
      picked: picked?.size ?? 0,
      all,
      onToggleAll: () => setPicking({ scope, picked: all ? new Set() : pickable }),
      onDownload: () => {
        if (picked) start(remaining.filter((episode) => picked.has(episode.number)).map(jobFor));
        setPicking(null);
      },
    },
  };
}
