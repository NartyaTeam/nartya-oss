import useEmblaCarousel from "embla-carousel-react";
import { Info, Play, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../ui/Button.tsx";
import { dedupeBySlug } from "../rows.ts";
import type { HeroItem } from "../types.ts";

const AUTOPLAY_MS = 8000;

const ACTION =
  "h-11 min-w-0 flex-1 px-4 py-0 text-sm sm:flex-none md:h-auto md:px-6 md:py-3 md:text-base";

// The key art and the logo already arrive enriched from the server. The vignettes live
// inside the slide so everything travels together during a drag.
function HeroSlide({ item, active, load }: { item: HeroItem; active: boolean; load: boolean }) {
  const background = item.fanart ?? item.cover;

  return (
    <div
      className={`relative -mx-px h-full min-w-0 flex-[0_0_calc(100%+2px)] overflow-hidden md:mx-0 md:flex-[0_0_100%] ${
        active ? "z-[1]" : "z-0"
      }`}
    >
      <div className="absolute inset-0 bg-surface">
        {background && load && (
          <img
            src={background}
            alt=""
            aria-hidden="true"
            loading={active ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover object-center"
          />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent md:via-bg/35" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/30 to-transparent md:from-bg/95 md:via-bg/40" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 to-transparent md:from-bg/60" />

      <div className="absolute inset-0 flex items-end">
        <div
          className={`mx-auto w-full max-w-2xl px-5 pb-6 text-center md:mx-0 md:px-14 md:pb-20 md:text-left ${
            active ? "animate-slide-up" : "opacity-0"
          }`}
        >
          <p className="mb-3 flex items-center justify-center gap-2.5 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-white/65 md:mb-4 md:justify-start md:text-[0.7rem] md:text-muted">
            <span className="h-3 w-[3px] bg-primary" />À la une
          </p>

          {item.clearLogo && load ? (
            <span className="relative mx-auto mb-4 block h-20 w-[75%] shrink-0 overflow-hidden md:mx-0 md:mb-5 md:h-32 md:w-[70%]">
              <img
                src={item.clearLogo}
                alt={item.title}
                loading={active ? "eager" : "lazy"}
                decoding="async"
                className="absolute inset-0 h-full w-full origin-center object-contain object-center md:origin-left md:object-left"
              />
            </span>
          ) : (
            <h1 className="text-glow mb-4 font-display text-3xl font-extrabold leading-[0.95] md:mb-5 md:text-6xl">
              {item.title}
            </h1>
          )}

          <div className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs text-white/70 md:mb-4 md:justify-start md:gap-x-4 md:gap-y-2 md:text-sm md:text-muted">
            {item.score !== null && (
              <span className="flex items-center gap-1 font-semibold text-accent">
                <Star size={14} className="fill-accent" />
                {item.score.toFixed(1)}
              </span>
            )}
            {item.year !== null && <span>{item.year}</span>}
            {item.format && <span className="uppercase">{item.format}</span>}
            {item.episodes !== null && <span>{item.episodes} ép.</span>}
            <span className="flex gap-2">
              {item.genres.slice(0, 3).map((genre) => (
                <span
                  key={genre}
                  className="rounded bg-white/[0.08] px-2.5 py-0.5 text-xs text-text"
                >
                  {genre}
                </span>
              ))}
            </span>
          </div>

          {item.description && (
            <p className="mx-auto mb-4 line-clamp-2 max-w-xl text-xs leading-relaxed text-white/65 md:mx-0 md:mb-6 md:line-clamp-3 md:text-sm md:text-muted">
              {item.description}
            </p>
          )}

          <div className="flex items-center gap-2.5 md:gap-3">
            <Button
              disabled
              size="lg"
              title="Le lecteur arrive avec la page anime"
              className={ACTION}
            >
              <Play size={18} className="fill-current" />
              Regarder
            </Button>
            <Button
              disabled
              variant="ghost"
              size="lg"
              title="La page anime arrive"
              className={ACTION}
            >
              <Info size={18} />
              Détails
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroView({ items }: { items: HeroItem[] }) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: true, duration: 30 });
  const [selected, setSelected] = useState(0);
  const [visible, setVisible] = useState(true);
  const hovering = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  const slides = useMemo(() => dedupeBySlug(items), [items]);

  const read = useCallback(() => {
    if (embla) setSelected(embla.selectedScrollSnap());
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

  useEffect(() => {
    if (!embla || !visible) return;
    const id = setInterval(() => {
      if (!hovering.current && document.visibilityState === "visible") embla.scrollNext();
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [embla, visible]);

  // Off screen, the rotation is spending frames on something nobody is looking at.
  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? true),
      {
        rootMargin: "120px",
      },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (slides.length === 0) return null;

  return (
    <div
      ref={root}
      className="relative w-full px-4 pt-3 md:h-[70vh] md:min-h-[500px] md:px-0 md:pt-0"
      onMouseEnter={() => (hovering.current = true)}
      onMouseLeave={() => (hovering.current = false)}
    >
      <div className="relative h-[53svh] min-h-[29rem] max-h-[33rem] overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-card md:h-full md:max-h-none md:min-h-0 md:rounded-none md:border-0 md:shadow-none">
        <div className="isolate h-full select-none overflow-hidden" ref={emblaRef}>
          <div className="flex h-full">
            {slides.map((item, index) => (
              <HeroSlide
                key={item.slug}
                item={item}
                active={index === selected}
                load={
                  index === selected ||
                  index === (selected + 1) % slides.length ||
                  index === (selected - 1 + slides.length) % slides.length
                }
              />
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 right-8 z-10 hidden items-center gap-4 md:flex">
          <span className="font-display text-sm font-bold text-text">
            {String(selected + 1).padStart(2, "0")}
          </span>
          <div className="flex gap-1.5">
            {slides.map((item, index) => (
              <button
                key={item.slug}
                onClick={() => embla?.scrollTo(index)}
                aria-label={`Afficher le titre ${String(index + 1)}`}
                className={`h-[3px] rounded-full transition-all duration-300 ${
                  index === selected ? "w-7 bg-primary" : "w-3 bg-white/25 hover:bg-white/50"
                }`}
              />
            ))}
          </div>
          <span className="font-display text-sm font-bold text-muted">
            {String(slides.length).padStart(2, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}
