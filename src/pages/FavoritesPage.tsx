import { LayoutGrid, ListOrdered, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { FavoriteCard } from "../features/favorites/FavoriteCard.tsx";
import {
  byGenre,
  matching,
  type Favorite,
  type Favorites,
} from "../features/favorites/favorites.ts";
import { ReorderGrid } from "../features/favorites/ReorderGrid.tsx";
import { useFavorites } from "../features/favorites/store.ts";
import type { LastWatched, Progress } from "../features/player/progress.ts";
import { Empty } from "../ui/Empty.tsx";
import { Notice } from "../ui/Notice.tsx";

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-8";

type Mode = "genre" | "manual";

type FavoritesPageProps = { favorites: Favorites; progress: Progress; userId: string };

const MODE_BUTTON = "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium";

export function FavoritesPage({ favorites, progress, userId }: FavoritesPageProps) {
  const items = useFavorites((state) => state.items);
  const failed = useFavorites((state) => (state.failed?.slug === null ? state.failed : null));
  const reorder = useFavorites((state) => state.reorder);
  const load = useFavorites((state) => state.load);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("genre");
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
            title="Favoris indisponibles"
            note={failed.message}
            onRetry={() => void load(favorites, userId)}
          />
        ) : (
          <p className="text-sm text-muted">Chargement…</p>
        )}
      </div>
    );
  }

  const shown = matching(items, query);
  const searching = query.trim() !== "";
  const tile = (favorite: Favorite, sortable = false) => (
    <FavoriteCard favorite={favorite} last={last[favorite.slug]} sortable={sortable} />
  );

  return (
    <div className="animate-fade-in px-4 pb-24 pt-24 sm:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-black">Favoris</h1>
          <p className="mt-1 text-sm text-muted">
            {items.length} anime{items.length > 1 ? "s" : ""}
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-md bg-surface px-3 py-1.5 ring-1 ring-line focus-within:ring-primary/60">
              <Search size={15} className="text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher"
                aria-label="Rechercher dans les favoris"
                className="w-44 bg-transparent text-sm outline-none placeholder:text-muted/60"
              />
            </label>
            <div className="flex rounded-md bg-surface p-0.5 ring-1 ring-line">
              {(
                [
                  ["genre", LayoutGrid, "Par genre"],
                  ["manual", ListOrdered, "Ordre manuel"],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`${MODE_BUTTON} ${mode === value ? "bg-primary text-primary-fg" : "text-muted hover:text-text"}`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {failed && (
        <div className="mb-6">
          <Notice kind="error">{failed.message}</Notice>
        </div>
      )}

      {items.length === 0 ? (
        <Empty
          title="Ta collection commence ici"
          note="Ajoute tes animes préférés depuis leur fiche pour les retrouver ici."
        />
      ) : shown.length === 0 ? (
        <Empty title="Aucun résultat" note={`Aucun favori ne correspond à « ${query.trim()} ».`} />
      ) : mode === "manual" ? (
        <>
          {searching && (
            <p className="mb-4 text-xs text-muted">Efface la recherche pour réordonner.</p>
          )}
          {searching ? (
            <div className={GRID}>
              {shown.map((favorite) => (
                <div key={favorite.slug}>{tile(favorite)}</div>
              ))}
            </div>
          ) : (
            <ReorderGrid
              items={shown}
              keyOf={(favorite) => favorite.slug}
              render={(favorite) => tile(favorite, true)}
              onReorder={(order) => void reorder(favorites, order)}
              className={GRID}
            />
          )}
        </>
      ) : (
        <div className="space-y-10">
          {byGenre(shown).map(([genre, group]) => (
            <section key={genre}>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="font-display text-lg font-bold">{genre}</h2>
                <span className="text-xs tabular-nums text-muted">{group.length}</span>
                <span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" />
              </div>
              <div className={GRID}>
                {group.map((favorite) => (
                  <div key={favorite.slug}>{tile(favorite)}</div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
