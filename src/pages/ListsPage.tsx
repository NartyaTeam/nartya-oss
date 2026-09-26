import { MousePointerClick } from "lucide-react";
import { useEffect, useState } from "react";
import {
  countByStatus,
  STATUSES,
  statusLine,
  type Lists,
  type Status,
} from "../features/lists/lists.ts";
import { StatusMenu } from "../features/lists/StatusMenu.tsx";
import { useLists } from "../features/lists/store.ts";
import type { LastWatched, Progress } from "../features/player/progress.ts";
import { Empty } from "../ui/Empty.tsx";
import { Notice } from "../ui/Notice.tsx";
import { PosterCard } from "../ui/PosterCard.tsx";
import { ReorderGrid } from "../ui/ReorderGrid.tsx";

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-8";

const COPY: Record<Status, [string, string]> = {
  watching: ["En cours", "Les séries que tu regardes en ce moment."],
  planned: ["À voir ensuite", "Ta file d'attente, prête pour la prochaine soirée."],
  completed: ["Terminés", "Les histoires que tu as déjà parcourues."],
  dropped: ["Abandonnés", "Mis de côté, sans encombrer le reste."],
};

type ListsPageProps = { lists: Lists; progress: Progress; userId: string };

export function ListsPage({ lists, progress, userId }: ListsPageProps) {
  const items = useLists((state) => state.items);
  const failed = useLists((state) => state.failed);
  const [active, setActive] = useState<Status>("planned");
  const [last, setLast] = useState<Record<string, LastWatched>>({});

  const slugs = (items ?? []).map((entry) => entry.slug).join(",");
  useEffect(() => {
    let live = true;
    void progress.lastWatchedIn(userId, slugs ? slugs.split(",") : []).then((found) => {
      if (live) setLast(found);
    });
    return () => {
      live = false;
    };
  }, [progress, userId, slugs]);

  if (!items) {
    return (
      <div className="px-4 pt-24 sm:px-8">
        {failed ? (
          <Empty
            title="Listes indisponibles"
            note={failed.message}
            onRetry={() => void useLists.getState().load(lists, userId)}
          />
        ) : (
          <p className="text-sm text-muted">Chargement…</p>
        )}
      </div>
    );
  }

  const counts = countByStatus(items);
  const shown = items.filter((entry) => entry.status === active);
  const [title, note] = COPY[active];
  const now = new Date();

  return (
    <div className="animate-fade-in px-4 pb-24 pt-24 sm:px-8">
      <h1 className="font-display text-3xl font-black">Mes listes</h1>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {STATUSES.map((status) => (
          <button
            key={status.key}
            type="button"
            role="tab"
            aria-selected={active === status.key}
            onClick={() => setActive(status.key)}
            className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium ring-1 transition-colors ${
              active === status.key
                ? "bg-primary/15 text-primary ring-primary/40"
                : "bg-surface text-muted ring-line hover:text-text"
            }`}
          >
            {status.label}
            <span className="text-xs tabular-nums opacity-70">{counts[status.key]}</span>
          </button>
        ))}
      </div>

      <div className="mb-6 mt-8">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{note}</p>
        {shown.length > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted/70">
            <MousePointerClick size={13} />
            Clic droit sur une carte pour changer son statut, glisse-la pour la déplacer.
          </p>
        )}
      </div>

      {failed && (
        <div className="mb-6">
          <Notice kind="error">{failed.message}</Notice>
        </div>
      )}

      {shown.length === 0 ? (
        <Empty
          title="Rien pour l'instant"
          note={`Choisis « ${STATUSES.find((status) => status.key === active)?.label ?? ""} » depuis la fiche d'un anime pour le retrouver ici.`}
        />
      ) : (
        <ReorderGrid
          items={shown}
          keyOf={(entry) => entry.slug}
          render={(entry) => (
            <StatusMenu
              status={entry.status}
              onStatus={(status) => void useLists.getState().place(lists, { ...entry, status })}
              onRemove={() => void useLists.getState().remove(lists, entry.slug)}
            >
              <PosterCard
                anime={entry}
                last={last[entry.slug]}
                sortable
                detail={statusLine(entry.status, entry.changedAt, now)}
                onRemove={() => void useLists.getState().remove(lists, entry.slug)}
              />
            </StatusMenu>
          )}
          onReorder={(order) => void useLists.getState().reorder(lists, active, order)}
          className={GRID}
        />
      )}
    </div>
  );
}
