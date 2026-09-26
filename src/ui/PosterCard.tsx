import { Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { LastWatched } from "../features/player/progress.ts";

type PosterCardProps = {
  anime: { slug: string; title: string; cover: string | null };
  last: LastWatched | undefined;
  sortable: boolean;
  detail?: string | null;
  onRemove?: () => void;
};

export function PosterCard({ anime, last, sortable, detail, onRemove }: PosterCardProps) {
  return (
    <div className="group relative">
      <Link
        to={`/anime/${encodeURIComponent(anime.slug)}`}
        // While reordering the card is what moves, not the link it carries.
        draggable={!sortable}
        className="block w-full text-left"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface-2">
          {anime.cover ? (
            <img
              src={anime.cover}
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
          {anime.title}
        </h3>
        {detail && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{detail}</p>}
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
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          // A press or a key on the button must not start dragging the card it sits on.
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          aria-label={`Retirer ${anime.title} de ma liste`}
          title="Retirer de ma liste"
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white opacity-0 backdrop-blur-sm transition-opacity hover:text-primary focus:opacity-100 group-hover:opacity-100"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
