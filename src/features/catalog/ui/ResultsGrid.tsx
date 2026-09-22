import type { AnimeCard } from "../types.ts";
import { AnimeCardView } from "./AnimeCardView.tsx";

export function ResultsGrid({ items }: { items: AnimeCard[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-4 gap-y-6">
      {items.map((anime) => (
        <AnimeCardView key={anime.slug} anime={anime} />
      ))}
    </div>
  );
}
