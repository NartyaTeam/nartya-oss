import { DownloadCloud, ListChecks, Loader2, X } from "lucide-react";

type SeasonDownloadsProps = {
  remaining: number;
  active: number;
  picking: boolean;
  onAll: () => void;
  onTogglePicking: () => void;
  onCancelActive: () => void;
};

const CONTROL =
  "flex h-10 items-center gap-2 rounded-md bg-surface px-3.5 text-sm font-medium text-text ring-1 ring-line transition-colors";

// One control that turns into its own undo while something runs, so the click that stops a
// season lands where the one that started it did.
export function SeasonDownloads(props: SeasonDownloadsProps) {
  const { remaining, active, picking } = props;

  return (
    <>
      {active > 0 ? (
        <button
          type="button"
          onClick={props.onCancelActive}
          title="Annuler les téléchargements de cette saison (les épisodes terminés sont gardés)"
          className={`group ${CONTROL} hover:bg-red-500/20 hover:text-red-400 hover:ring-red-500/40`}
        >
          <Loader2 size={16} className="animate-spin group-hover:hidden" />
          <X size={16} className="hidden group-hover:block" />
          <span className="hidden sm:inline">Annuler la saison</span>
          <span className="tabular-nums opacity-70">{active}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={props.onAll}
          disabled={remaining === 0}
          title={
            remaining === 0
              ? "Tous les épisodes de cette saison sont déjà téléchargés"
              : "Télécharger tous les épisodes de cette saison"
          }
          className={`${CONTROL} hover:bg-surface-2 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <DownloadCloud size={16} />
          <span className="hidden sm:inline">Télécharger la saison</span>
          {remaining > 0 && <span className="tabular-nums opacity-70">({remaining})</span>}
        </button>
      )}
      <button
        type="button"
        onClick={props.onTogglePicking}
        disabled={remaining === 0 && !picking}
        title={picking ? "Fermer la sélection" : "Choisir les épisodes à télécharger"}
        className={`flex h-10 w-10 items-center justify-center rounded-md ring-1 ring-line transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          picking ? "bg-primary text-primary-fg" : "bg-surface text-muted hover:text-text"
        }`}
      >
        {picking ? <X size={16} /> : <ListChecks size={16} />}
      </button>
    </>
  );
}
