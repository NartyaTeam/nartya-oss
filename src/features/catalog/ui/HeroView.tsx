import type { HeroItem } from "../types.ts";

export function HeroView({ item }: { item: HeroItem }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-neutral-800">
      {item.fanart && (
        <img src={item.fanart} alt="" className="h-64 w-full object-cover opacity-60 sm:h-80" />
      )}
      <div
        className={`flex flex-col gap-3 p-6 ${item.fanart ? "absolute inset-x-0 bottom-0 bg-gradient-to-t from-neutral-950 to-transparent pt-20" : ""}`}
      >
        {item.clearLogo ? (
          <img src={item.clearLogo} alt={item.title} className="max-h-20 w-auto self-start" />
        ) : (
          <h1 className="text-3xl font-semibold">{item.title}</h1>
        )}
        {item.description && (
          <p className="line-clamp-2 max-w-xl text-sm text-neutral-300">{item.description}</p>
        )}
      </div>
    </section>
  );
}
