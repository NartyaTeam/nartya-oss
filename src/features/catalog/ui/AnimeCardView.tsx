import type { AnimeCard } from "../types.ts";

type CardProps = { anime: AnimeCard; rank?: number };

export function AnimeCardView({ anime, rank }: CardProps) {
  return (
    <figure className="group w-36 shrink-0 sm:w-40">
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line/70 transition duration-300 group-hover:ring-primary/60">
        {anime.cover ? (
          <img
            src={anime.cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted">
            {anime.title}
          </div>
        )}
        {rank !== undefined && (
          <span className="absolute bottom-0 left-1 font-display text-5xl font-black leading-none text-bg [-webkit-text-stroke:2px_rgb(var(--text))]">
            {rank}
          </span>
        )}
        {anime.score !== null && (
          <span className="absolute right-1 top-1 rounded-lg bg-bg/80 px-1.5 py-0.5 text-xs text-accent">
            {anime.score.toFixed(1)}
          </span>
        )}
      </div>
      <figcaption className="mt-2 line-clamp-2 text-sm text-text/90">{anime.title}</figcaption>
    </figure>
  );
}
