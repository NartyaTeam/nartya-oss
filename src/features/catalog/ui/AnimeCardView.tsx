import { Play, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { AnimeCard } from "../types.ts";

type CardProps = { anime: AnimeCard; index?: number };

// Portrait poster, sober: no border, no scale on the frame, the cover itself moves, and a
// veil with a play button on hover.
export function AnimeCardView({ anime, index }: CardProps) {
  const image = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  // A cover already in cache never fires load, and a fast scroll would leave a black hole
  // where the sweep should be.
  useEffect(() => {
    setLoaded(false);
    if (image.current?.complete) setLoaded(true);
  }, [anime.cover]);

  return (
    <Link to={`/anime/${encodeURIComponent(anime.slug)}`} className="group block w-full text-left">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface-2">
        {anime.cover ? (
          <>
            {!loaded && <div className="skeleton absolute inset-0" />}
            <img
              ref={image}
              src={anime.cover}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(true)}
              className={`h-full w-full object-cover transition-[transform,opacity] duration-300 ease-out group-hover:scale-105 ${
                loaded ? "opacity-100" : "opacity-0"
              }`}
            />
          </>
        ) : (
          <div className="skeleton h-full w-full" />
        )}

        <div className="absolute inset-0 hidden items-center justify-center opacity-0 transition-all duration-200 group-hover:bg-black/45 group-hover:opacity-100 md:flex">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-fg">
            <Play size={18} className="ml-0.5 fill-current" />
          </span>
        </div>

        {index !== undefined && (
          <span className="absolute left-1.5 top-1 font-display text-xl font-extrabold leading-none text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}

        {anime.score !== null && (
          <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[0.68rem] font-semibold backdrop-blur-sm">
            <Star size={10} className="fill-accent text-accent" />
            {anime.score.toFixed(1)}
          </span>
        )}
      </div>

      <div>
        <h3 className="mt-2 line-clamp-1 text-sm font-semibold text-text transition-colors group-hover:text-primary">
          {anime.title}
        </h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted">
          {anime.genres.slice(0, 2).join(" · ")}
        </p>
      </div>
    </Link>
  );
}
