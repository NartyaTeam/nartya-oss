import type { HeroItem } from "../types.ts";

export function HeroView({ item }: { item: HeroItem }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line/70">
      {item.fanart && (
        <img
          src={item.fanart}
          alt=""
          className="h-64 w-full animate-ken-burns object-cover opacity-70 sm:h-80"
        />
      )}
      <div
        className={`flex flex-col gap-3 p-6 ${item.fanart ? "absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg/80 to-transparent pt-24" : ""}`}
      >
        {item.clearLogo ? (
          <img src={item.clearLogo} alt={item.title} className="max-h-20 w-auto self-start" />
        ) : (
          <h1 className="font-display text-4xl font-black">{item.title}</h1>
        )}
        {item.description && (
          <p className="line-clamp-2 max-w-xl text-sm text-text/80">{item.description}</p>
        )}
      </div>
    </section>
  );
}
