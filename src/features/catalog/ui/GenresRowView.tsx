import { Link } from "react-router-dom";
import type { GenreCard } from "../types.ts";
import { CarouselRow } from "./CarouselRow.tsx";

export function GenresRowView({ genres }: { genres: GenreCard[] }) {
  return (
    <CarouselRow title="Genres" kana="ジャンル">
      {genres.map((card) => (
        <Link
          key={card.genre}
          to={`/genre/${encodeURIComponent(card.genre)}`}
          className="group min-w-0 shrink-0 grow-0 basis-[200px] sm:basis-[230px]"
        >
          <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-2">
            {card.image ? (
              <img
                src={card.image}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover opacity-70 transition-transform duration-300 ease-out group-hover:scale-105"
              />
            ) : (
              <div className="skeleton h-full w-full" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-3 text-left font-display text-lg font-bold text-white transition-colors [text-shadow:0_1px_6px_rgba(0,0,0,0.85)] group-hover:text-primary">
              {card.genre}
            </span>
          </div>
        </Link>
      ))}
    </CarouselRow>
  );
}
