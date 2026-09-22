import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

type CarouselRowProps = {
  title: string;
  kana?: string | null;
  gap?: "3" | "4";
  children: ReactNode;
};

const ARROW =
  "flex h-8 w-8 items-center justify-center rounded text-muted transition-colors hover:bg-white/[0.06] hover:text-text disabled:pointer-events-none disabled:opacity-25";

// Rows scroll rather than wrap: a grid would put hundreds of covers on screen at once and
// the page would stop meaning anything.
export function CarouselRow({ title, kana, gap = "4", children }: CarouselRowProps) {
  const [emblaRef, embla] = useEmblaCarousel({
    dragFree: true,
    containScroll: "trimSnaps",
    align: "start",
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const read = useCallback(() => {
    if (!embla) return;
    setCanPrev(embla.canScrollPrev());
    setCanNext(embla.canScrollNext());
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    read();
    embla.on("select", read);
    embla.on("reInit", read);
    return () => {
      embla.off("select", read);
      embla.off("reInit", read);
    };
  }, [embla, read]);

  return (
    <section className="relative">
      <div className="mb-3 flex items-center justify-between px-4 sm:px-8">
        <h2 className="flex items-baseline gap-2.5 font-display text-xl font-bold tracking-tight">
          {kana && <span className="text-base font-medium text-muted/60">{kana}</span>}
          {title}
        </h2>
        <div className="hidden gap-1 md:flex">
          <button onClick={() => embla?.scrollPrev()} disabled={!canPrev} className={ARROW}>
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => embla?.scrollNext()} disabled={!canNext} className={ARROW}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="select-none overflow-hidden px-4 sm:px-8" ref={emblaRef}>
        <div className={gap === "3" ? "flex gap-3" : "flex gap-4"}>{children}</div>
      </div>
    </section>
  );
}
