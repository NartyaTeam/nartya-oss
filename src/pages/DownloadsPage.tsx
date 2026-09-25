import { Eraser, FolderOpen, HardDrive, WifiOff } from "lucide-react";
import { useState } from "react";
import type { EpisodeDownload } from "../../shared/downloads.ts";
import type { Anime } from "../features/anime/anime.ts";
import { DownloadGroup } from "../features/downloads/DownloadGroup.tsx";
import { formatSize, groupLibrary, isFailed } from "../features/downloads/library.ts";
import { downloadOrder } from "../features/downloads/prepare.ts";
import { useDownloads } from "../features/downloads/store.ts";
import { useNetwork } from "../features/network/store.ts";
import { AUTO } from "../features/player/sources.ts";
import { getPlatform } from "../lib/platform.ts";
import { Empty } from "../ui/Empty.tsx";

const COLLAPSED_KEY = "nartya:downloads-collapsed";

function readCollapsed(): Record<string, boolean> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "{}");
    if (typeof saved !== "object" || saved === null) return {};
    return Object.fromEntries(
      Object.entries(saved).flatMap(([slug, folded]) => (folded === true ? [[slug, true]] : [])),
    );
  } catch {
    return {};
  }
}

const HEADER_CHIP =
  "flex items-center gap-2 rounded-md bg-surface px-3 py-1.5 text-sm ring-1 ring-line transition-colors";

export function DownloadsPage({ anime }: { anime: Anime }) {
  const { items, preparing, failed, start, cancel, remove } = useDownloads();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const bridge = getPlatform()?.downloads;
  const offline = useNetwork((state) => state.checked && !state.online);

  const groups = groupLibrary(Object.values(items));
  const bytes = groups.reduce((sum, group) => sum + group.bytes, 0);
  const failedIds = groups
    .flatMap((group) => group.items)
    .filter((item) => isFailed(item) || failed[item.id])
    .map((item) => item.id);

  const toggle = (slug: string): void => {
    const next = { ...collapsed, [slug]: !collapsed[slug] };
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked: the fold still holds until the page is left.
    }
  };

  // The record keeps no source token, they expire: the season is read again for fresh ones.
  const retry = async (item: EpisodeDownload): Promise<void> => {
    const answer = await anime.episodes(item.slug, item.seasonId);
    const episode = answer.ok
      ? answer.data.episodes.find((entry) => entry.number === item.ep)
      : undefined;
    const { slug, seasonId, ep, lang, animeTitle, animeCover, epThumb, epTitle, seasonName } = item;
    start([
      {
        details: { slug, seasonId, ep, lang, animeTitle, animeCover, epThumb, epTitle, seasonName },
        sources: downloadOrder(episode?.sources[lang] ?? [], AUTO),
      },
    ]);
  };

  const removeMany = (ids: string[]): void => {
    for (const id of ids) remove(id);
  };

  return (
    <div className="animate-fade-in px-4 pb-24 pt-24 sm:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black">Téléchargements</h1>
          {offline ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-amber-300">
              <WifiOff size={14} />
              Hors ligne : seuls tes épisodes téléchargés sont disponibles.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">
              Tes épisodes disponibles hors ligne, sur cet appareil.
            </p>
          )}
        </div>
        {bridge && (
          <div className="flex flex-wrap items-center gap-2">
            {failedIds.length > 0 && (
              <button
                type="button"
                onClick={() => removeMany(failedIds)}
                title="Retirer toutes les entrées en échec"
                className={`${HEADER_CHIP} text-primary hover:bg-primary/10`}
              >
                <Eraser size={15} />
                Purger les échecs
                <span className="tabular-nums opacity-70">({failedIds.length})</span>
              </button>
            )}
            <span className={`${HEADER_CHIP} text-muted`}>
              <HardDrive size={15} />
              {formatSize(bytes)}
            </span>
            <button
              type="button"
              onClick={() => void bridge.openFolder()}
              title="Ouvrir le dossier des téléchargements"
              className={`${HEADER_CHIP} text-muted hover:bg-surface-2 hover:text-text`}
            >
              <FolderOpen size={15} />
              Dossier
            </button>
          </div>
        )}
      </div>

      {!bridge ? (
        <Empty
          title="Réservé à l'application"
          note="Le téléchargement n'est disponible que dans l'application de bureau."
        />
      ) : groups.length === 0 ? (
        <Empty
          title="Aucun épisode téléchargé"
          note="Ouvre un anime et utilise le bouton de téléchargement d'un épisode pour le regarder hors ligne."
        />
      ) : (
        <div className="overflow-hidden rounded-md ring-1 ring-line">
          {groups.map((group) => (
            <DownloadGroup
              key={group.slug}
              group={group}
              collapsed={collapsed[group.slug] === true}
              preparing={preparing}
              failed={failed}
              onToggle={() => toggle(group.slug)}
              onRetry={(item) => void retry(item)}
              onCancel={cancel}
              onRemove={removeMany}
            />
          ))}
        </div>
      )}
    </div>
  );
}
