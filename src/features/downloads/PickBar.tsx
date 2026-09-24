import { CheckSquare, Download, Square } from "lucide-react";

type PickBarProps = {
  picked: number;
  all: boolean;
  onToggleAll: () => void;
  onDownload: () => void;
};

export function PickBar({ picked, all, onToggleAll, onDownload }: PickBarProps) {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-md bg-surface px-2 py-2 ring-1 ring-line">
      <button
        type="button"
        onClick={onToggleAll}
        className={`flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
          all ? "bg-primary/15 text-primary ring-1 ring-primary/40" : "text-muted hover:text-text"
        }`}
      >
        {all ? <CheckSquare size={16} /> : <Square size={16} />}
        Tout
      </button>
      <span className="flex-1 text-center text-sm text-muted">
        {picked === 0 ? "Aucun épisode" : `${String(picked)} épisode${picked > 1 ? "s" : ""}`}
      </span>
      <button
        type="button"
        onClick={onDownload}
        disabled={picked === 0}
        className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Download size={16} />
        Télécharger
      </button>
    </div>
  );
}
