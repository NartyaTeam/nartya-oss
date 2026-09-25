import { ChevronDown, Eraser, ImageOff, ListChecks, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { EpisodeDownload } from "../../../shared/downloads.ts";
import { DownloadRow } from "./DownloadRow.tsx";
import { formatSize, isFailed, isRunning, type Group } from "./library.ts";
import { useLocalImage } from "./useLocalImage.ts";

// An armed delete goes back to rest on its own rather than staying one click from loss.
const CONFIRM_MS = 4000;

type DownloadGroupProps = {
  group: Group;
  collapsed: boolean;
  preparing: Record<string, true>;
  failed: Record<string, string>;
  onToggle: () => void;
  onRetry: (item: EpisodeDownload) => void;
  onCancel: (id: string) => void;
  onRemove: (ids: string[]) => void;
};

const HEADER_BUTTON =
  "flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors";

export function DownloadGroup(props: DownloadGroupProps) {
  const { group, collapsed } = props;
  const cover = useLocalImage(group.coverOwner.id, group.coverOwner.coverFile, group.cover);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const id = window.setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => window.clearTimeout(id);
  }, [confirming]);

  const settled = group.items.filter((item) => !isRunning(item) && !props.preparing[item.id]);
  const failedIds = group.items
    .filter((item) => isFailed(item) || props.failed[item.id])
    .map((item) => item.id);

  const removeAll = (): void => {
    for (const item of group.items) if (isRunning(item)) props.onCancel(item.id);
    props.onRemove(settled.map((item) => item.id));
    setConfirming(false);
  };

  const toggle = (id: string): void => {
    if (!picked) return;
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const allPicked = picked !== null && settled.every((item) => picked.has(item.id));

  return (
    <div className="border-t border-line/60 first:border-t-0">
      <div className="flex items-center gap-1 px-2 py-1.5 transition-colors hover:bg-white/[0.03]">
        <button
          type="button"
          onClick={props.onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1 text-left"
        >
          <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-surface-2">
            {cover ? (
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted">
                <ImageOff size={15} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-1 text-sm font-semibold text-text">{group.title}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {group.done} épisode{group.done > 1 ? "s" : ""}
              {group.running > 0 && (
                <span className="text-primary"> · {group.running} en cours</span>
              )}
              {group.failed > 0 && <span className="text-primary"> · {group.failed} en échec</span>}
              {" · "}
              {formatSize(group.bytes)}
            </p>
          </div>
          <ChevronDown
            size={18}
            className={`shrink-0 text-muted transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
        </button>

        <div className="flex shrink-0 items-center gap-0.5 pr-1.5">
          {failedIds.length > 0 && (
            <button
              type="button"
              onClick={() => props.onRemove(failedIds)}
              title={`Retirer les ${String(failedIds.length)} en échec`}
              className={`${HEADER_BUTTON} w-8 px-0 text-muted hover:bg-white/[0.06] hover:text-primary`}
            >
              <Eraser size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setPicked(picked ? null : new Set());
              if (collapsed) props.onToggle();
            }}
            title={picked ? "Fermer la sélection" : "Choisir des épisodes à supprimer"}
            className={`${HEADER_BUTTON} w-8 px-0 hover:bg-white/[0.06] ${picked ? "text-primary" : "text-muted"}`}
          >
            <ListChecks size={16} />
          </button>
          <button
            type="button"
            onClick={() => (confirming ? removeAll() : setConfirming(true))}
            title={
              confirming
                ? "Cliquer à nouveau pour confirmer"
                : "Supprimer tous les épisodes de cet anime"
            }
            className={`${HEADER_BUTTON} ${
              confirming
                ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/40"
                : "text-muted hover:bg-white/[0.06] hover:text-primary"
            }`}
          >
            <Trash2 size={16} />
            {confirming && "Confirmer ?"}
          </button>
        </div>
      </div>

      {picked && (
        <div className="flex items-center gap-3 border-y border-line/60 bg-white/[0.02] px-4 py-2 text-sm">
          <button
            type="button"
            onClick={() => setPicked(new Set(allPicked ? [] : settled.map((item) => item.id)))}
            className="text-muted transition-colors hover:text-text"
          >
            Tout {allPicked ? "désélectionner" : "sélectionner"}
          </button>
          <span className="text-muted">
            {picked.size} sélectionné{picked.size > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={() => {
              props.onRemove([...picked]);
              setPicked(null);
            }}
            disabled={picked.size === 0}
            className="ml-auto flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1 font-medium text-primary ring-1 ring-line transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={14} />
            Supprimer
          </button>
        </div>
      )}

      {/* Rows 0fr to 1fr, so the group folds smoothly whatever its height. */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
      >
        <div className="divide-y divide-line/40 overflow-hidden bg-black/15">
          {group.items.map((item) => (
            <DownloadRow
              key={item.id}
              item={item}
              cover={group.cover}
              failed={props.failed[item.id]}
              preparing={props.preparing[item.id] === true}
              picking={
                picked ? { picked: picked.has(item.id), toggle: () => toggle(item.id) } : null
              }
              onRetry={() => props.onRetry(item)}
              onCancel={() => props.onCancel(item.id)}
              onRemove={() => props.onRemove([item.id])}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
