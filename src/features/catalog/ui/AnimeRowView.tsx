import type { Row } from "../types.ts";
import { AnimeCardView } from "./AnimeCardView.tsx";

// Rows scroll rather than wrap: a grid would put hundreds of covers on screen at once and
// the page would stop meaning anything.
export function AnimeRowView({ row }: { row: Row }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-baseline gap-3 font-display text-xl font-bold">
        {row.title}
        {row.kana && (
          <span className="text-xs uppercase tracking-kana text-muted/70">{row.kana}</span>
        )}
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {row.items.map((anime, index) => (
          <AnimeCardView
            key={`${row.key}-${anime.slug}`}
            anime={anime}
            rank={row.variant === "numbered" ? index + 1 : undefined}
          />
        ))}
      </div>
    </section>
  );
}

export function RowSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <div className="h-6 w-40 rounded-xl bg-surface" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="aspect-[2/3] w-36 shrink-0 rounded-2xl bg-surface sm:w-40" />
        ))}
      </div>
    </section>
  );
}
