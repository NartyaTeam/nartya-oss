import {
  AlertTriangle,
  CheckSquare,
  ImageOff,
  Loader2,
  RotateCcw,
  Square,
  Trash2,
  X,
} from "lucide-react";
import type { EpisodeDownload } from "../../../shared/downloads.ts";
import { formatSize, isFailed, isRunning } from "./library.ts";
import { useLocalImage } from "./useLocalImage.ts";

type DownloadRowProps = {
  item: EpisodeDownload;
  cover: string | null;
  failed: string | undefined;
  preparing: boolean;
  picking: { picked: boolean; toggle: () => void } | null;
  onRetry: () => void;
  onCancel: () => void;
  onRemove: () => void;
};

const ICON_BUTTON =
  "shrink-0 rounded p-2 text-muted transition-colors hover:bg-white/[0.06] hover:text-primary";

function status(item: EpisodeDownload, preparing: boolean, failed: string | undefined) {
  if (preparing) return { tone: "running", text: "Recherche d'une source…" } as const;
  if (isRunning(item)) {
    const text =
      item.status === "queued"
        ? "En attente…"
        : item.status === "processing"
          ? "Finalisation…"
          : `Téléchargement… ${String(Math.round(item.percent))} %`;
    return { tone: "running", text } as const;
  }
  if (failed || isFailed(item)) {
    return { tone: "failed", text: failed ?? item.error ?? "Échec du téléchargement" } as const;
  }
  return { tone: "done", text: formatSize(item.sizeBytes) } as const;
}

export function DownloadRow(props: DownloadRowProps) {
  const { item, preparing, picking } = props;
  const thumb = useLocalImage(item.id, item.thumbFile, item.epThumb ?? props.cover);
  const state = status(item, preparing, props.failed);
  const running = state.tone === "running";
  const season = item.seasonName ? `${item.seasonName} · ` : "";

  return (
    <div className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-white/[0.04]">
      {picking && (
        <button
          type="button"
          onClick={picking.toggle}
          disabled={running}
          title={running ? "En cours, annule le téléchargement pour le retirer" : "Sélectionner"}
          className="shrink-0 disabled:opacity-30"
        >
          {picking.picked ? (
            <CheckSquare size={19} className="text-primary" />
          ) : (
            <Square size={19} className="text-muted" />
          )}
        </button>
      )}

      <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-surface-2 sm:w-36">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <ImageOff size={18} />
          </div>
        )}
        <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[0.65rem] font-bold backdrop-blur-sm">
          {item.ep}
        </span>
        {item.status === "downloading" && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
            <span
              className="block h-full bg-primary transition-all"
              style={{ width: `${String(item.percent)}%` }}
            />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium">
          {item.epTitle ?? `Épisode ${String(item.ep)}`}
          <span className="ml-2 text-xs uppercase text-muted">{item.lang}</span>
        </p>
        <p
          className={`mt-0.5 flex items-center gap-1.5 text-xs ${state.tone === "failed" ? "text-primary" : "text-muted"}`}
        >
          {running && <Loader2 size={11} className="animate-spin" />}
          {state.tone === "failed" && <AlertTriangle size={11} />}
          <span className="line-clamp-1">
            {state.tone === "done" ? season : ""}
            {state.text}
          </span>
        </p>
      </div>

      {state.tone === "failed" && !picking && (
        <button type="button" onClick={props.onRetry} title="Réessayer" className={ICON_BUTTON}>
          <RotateCcw size={16} />
        </button>
      )}
      {!picking && (
        <button
          type="button"
          onClick={running ? props.onCancel : props.onRemove}
          title={running ? "Annuler" : "Supprimer"}
          className={ICON_BUTTON}
        >
          {running ? <X size={16} /> : <Trash2 size={16} />}
        </button>
      )}
    </div>
  );
}
