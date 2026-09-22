import { useMemo } from "react";
import { dedupeBySlug } from "../rows.ts";
import type { Row } from "../types.ts";
import { AnimeCardView } from "./AnimeCardView.tsx";
import { CarouselRow } from "./CarouselRow.tsx";

const SLIDE = "min-w-0 shrink-0 grow-0 basis-[148px] sm:basis-[160px]";

export function AnimeRowView({ row }: { row: Row }) {
  const items = useMemo(() => dedupeBySlug(row.items), [row.items]);

  return (
    <CarouselRow title={row.title} kana={row.kana}>
      {items.map((anime) => (
        <div key={anime.slug} className={SLIDE}>
          <AnimeCardView anime={anime} />
        </div>
      ))}
    </CarouselRow>
  );
}

// Editorial break in the rhythm of the plain rows: an outlined numeral the poster overlaps.
export function TopTenRowView({ row }: { row: Row }) {
  const items = useMemo(() => dedupeBySlug(row.items).slice(0, 10), [row.items]);

  return (
    <CarouselRow title={row.title} kana={row.kana} gap="3">
      {items.map((anime, index) => (
        <div key={anime.slug} className="flex shrink-0 grow-0 items-end">
          <span
            aria-hidden="true"
            className="pointer-events-none select-none font-display text-[7rem] font-black leading-[0.72] text-transparent lg:text-[8.5rem]"
            style={{ WebkitTextStroke: "2px rgb(96 92 99)" }}
          >
            {index + 1}
          </span>
          <div className="-ml-7 w-[140px] lg:w-[150px]">
            <AnimeCardView anime={anime} />
          </div>
        </div>
      ))}
    </CarouselRow>
  );
}

export function RowSkeleton() {
  return (
    <section>
      <div className="mb-3 px-4 sm:px-8">
        <div className="skeleton h-6 w-40 rounded" />
      </div>
      <div className="flex gap-4 overflow-hidden px-4 sm:px-8">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="skeleton aspect-[2/3] w-[148px] shrink-0 rounded-lg" />
        ))}
      </div>
    </section>
  );
}
