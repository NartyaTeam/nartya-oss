import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import type { LastWatched } from "../player/progress.ts";
import type { Favorite } from "./favorites.ts";

type FavoriteCardProps = { favorite: Favorite; last: LastWatched | undefined; sortable: boolean };

export function FavoriteCard({ favorite, last, sortable }: FavoriteCardProps) {
  return (
    <Link
      to={`/anime/${encodeURIComponent(favorite.slug)}`}
      // While reordering the card is what moves, not the link it carries.
      draggable={!sortable}
      className="group block w-full text-left"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface-2">
        {favorite.cover ? (
          <img
            src={favorite.cover}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full" />
        )}
      </div>
      <h3 className="mt-2 line-clamp-1 text-sm font-semibold text-text transition-colors group-hover:text-primary">
        {favorite.title}
      </h3>
      {last && (
        <p className="mt-1 flex items-center gap-2 text-xs text-muted">
          <span className="shrink-0 font-medium text-text/80">Ép. {last.episodeNumber}</span>
          {last.completed ? (
            <Check size={13} className="text-primary" aria-label="Vu" />
          ) : (
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full bg-primary"
                style={{ width: `${String(Math.min(100, last.percent))}%` }}
              />
            </span>
          )}
        </p>
      )}
    </Link>
  );
}
