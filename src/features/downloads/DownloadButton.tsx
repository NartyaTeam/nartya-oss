import { AlertTriangle, Check, Download, Loader2, X } from "lucide-react";
import type { DownloadItem } from "../../../shared/downloads.ts";

type DownloadButtonProps = {
  item: DownloadItem | undefined;
  preparing: boolean;
  failed: string | undefined;
  onStart: () => void;
  onCancel: () => void;
  onRemove: () => void;
};

const BUTTON =
  "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-white/[0.06]";

export function DownloadButton(props: DownloadButtonProps) {
  const { item, preparing } = props;
  const status = item?.status;

  if (preparing || status === "queued" || status === "downloading" || status === "processing") {
    const label =
      preparing || status === "queued"
        ? "…"
        : status === "processing"
          ? "⋯"
          : `${String(Math.round(item?.percent ?? 0))}%`;
    return (
      <button
        type="button"
        onClick={props.onCancel}
        title={
          status === "processing"
            ? "Finalisation, cliquer pour annuler"
            : "Annuler le téléchargement"
        }
        className={`${BUTTON} text-muted hover:text-primary`}
      >
        <Loader2 size={15} className="animate-spin" />
        <span className="w-8 text-right tabular-nums">{label}</span>
        <X size={13} />
      </button>
    );
  }

  if (status === "done") {
    return (
      <button
        type="button"
        onClick={props.onRemove}
        title="Téléchargé, cliquer pour supprimer"
        className={`${BUTTON} text-accent hover:text-primary`}
      >
        <Check size={15} />
        <span className="hidden sm:inline">Hors ligne</span>
      </button>
    );
  }

  const error = props.failed ?? (status === "error" ? item?.error : undefined);
  return (
    <button
      type="button"
      onClick={props.onStart}
      title={error ? `${error}, cliquer pour réessayer` : "Télécharger pour le hors ligne"}
      className={`${BUTTON} text-muted hover:text-text`}
    >
      {error ? <AlertTriangle size={15} className="text-primary" /> : <Download size={15} />}
    </button>
  );
}
