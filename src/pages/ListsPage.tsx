import {
  Bookmark,
  CircleCheck,
  CirclePause,
  CirclePlay,
  GripVertical,
  ListPlus,
  MousePointerClick,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AutoTrackSwitch } from "../features/lists/AutoTrackSwitch.tsx";
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

const GRID =
  "grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-x-5 sm:gap-y-8";

const SKELETONS = 6;

const COPY: Record<Status, [string, string]> = {
  watching: ["En cours", "Les séries que tu regardes en ce moment."],
  planned: ["À voir ensuite", "Ta file d'attente, prête pour la prochaine soirée."],
  completed: ["Terminés", "Les histoires que tu as déjà parcourues."],
  dropped: ["Abandonnés", "Mis de côté, sans encombrer le reste."],
};

const ICONS: Record<Status, LucideIcon> = {
  watching: CirclePlay,
  planned: Bookmark,
  completed: CircleCheck,
  dropped: CirclePause,
};

const HINT = "flex items-center gap-1.5";

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

  const counts = countByStatus(items ?? []);
  const shown = (items ?? []).filter((entry) => entry.status === active);
  const [title, note] = COPY[active];
  const label = STATUSES.find((status) => status.key === active)?.label ?? "";
  const now = new Date();

  return (
    <div className="animate-fade-in px-4 pb-24 pt-24 sm:px-8">
      <header className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-px w-6 bg-primary" />
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-primary/80">
            Carnet de visionnage
          </p>
        </div>
        <h1 className="font-display text-[2rem] font-bold leading-none tracking-tight md:text-3xl">
          Mes listes
        </h1>
      </header>

      <div className="-mx-4 mb-7 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div className="flex min-w-max border-b border-white/[0.07] sm:min-w-0" role="tablist">
          {STATUSES.map((status) => {
            const selected = active === status.key;
            const Icon = ICONS[status.key];
            return (
              <button
                key={status.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(status.key)}
                className={`relative flex min-w-[5.4rem] flex-1 items-center justify-center gap-1.5 px-2 pb-3 pt-2 text-xs font-medium transition-colors ${
                  selected ? "text-text" : "text-muted hover:text-text"
                }`}
              >
                <Icon size={14} className={selected ? "text-primary" : ""} />
                {status.label}
                <span
                  className={`text-[0.65rem] tabular-nums ${selected ? "text-primary" : "text-muted/65"}`}
                >
                  {counts[status.key]}
                </span>
                {selected && (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div>
          <h2 className="font-display text-lg font-bold text-text">{title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{note}</p>
          {shown.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-muted/70">
              <span className={HINT}>
                <MousePointerClick size={13} className="text-primary/70" />
                Clic droit pour changer le statut
              </span>
              {shown.length > 1 && (
                <span className={HINT}>
                  <GripVertical size={13} className="text-primary/70" />
                  Glisse une carte pour la déplacer
                </span>
              )}
            </div>
          )}
        </div>
        {active === "watching" && <AutoTrackSwitch />}
      </div>

      {failed && items && (
        <div className="mb-6">
          <Notice kind="error">{failed.message}</Notice>
        </div>
      )}

      {!items ? (
        failed ? (
          <Empty
            title="Listes indisponibles"
            note={failed.message}
            onRetry={() => void useLists.getState().load(lists, userId)}
          />
        ) : (
          <div className={GRID}>
            {Array.from({ length: SKELETONS }, (_, index) => (
              <div key={index} className="skeleton aspect-[2/3] rounded-xl" />
            ))}
          </div>
        )
      ) : shown.length === 0 ? (
        <div className="flex min-h-[40dvh] flex-col items-center justify-center rounded-2xl border border-dashed border-line/80 px-7 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            {active === "planned" ? <Bookmark size={24} /> : <ListPlus size={24} />}
          </span>
          <p className="mt-4 font-display text-lg font-bold text-text">Rien ici pour le moment</p>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted">
            {active === "planned"
              ? "Garde ici les animes qui te tentent, depuis leur fiche, pour ne plus les oublier."
              : `Les animes marqués « ${label} » apparaîtront ici.`}
          </p>
        </div>
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
