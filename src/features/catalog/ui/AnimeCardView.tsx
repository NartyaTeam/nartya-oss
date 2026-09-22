import type { AnimeCard } from "../types.ts";

type CardProps = { anime: AnimeCard; rank?: number };

export function AnimeCardView({ anime, rank }: CardProps) {
  return (
    <figure className="w-36 shrink-0 sm:w-40">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-neutral-800">
        {anime.cover ? (
          <img
            src={anime.cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs text-neutral-600">
            {anime.title}
          </div>
        )}
        {rank !== undefined && (
          <span className="absolute bottom-0 left-1 text-5xl font-bold leading-none text-neutral-950 [-webkit-text-stroke:2px_rgb(212,212,216)]">
            {rank}
          </span>
        )}
        {anime.score !== null && (
          <span className="absolute right-1 top-1 rounded bg-neutral-950/80 px-1.5 py-0.5 text-xs text-neutral-200">
            {anime.score.toFixed(1)}
          </span>
        )}
      </div>
      <figcaption className="mt-2 line-clamp-2 text-sm text-neutral-300">{anime.title}</figcaption>
    </figure>
  );
}
