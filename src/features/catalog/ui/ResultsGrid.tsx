import type { AnimeCard } from "../types.ts";
import { AnimeCardView } from "./AnimeCardView.tsx";

export function ResultsGrid({ items }: { items: AnimeCard[] }) {
  return (
    <div className="flex flex-wrap gap-4">
      {items.map((anime) => (
        <AnimeCardView key={anime.slug} anime={anime} />
      ))}
    </div>
  );
}
