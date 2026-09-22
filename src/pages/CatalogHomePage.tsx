import { Link } from "react-router-dom";
import type { Catalog } from "../features/catalog/catalog.ts";
import { AnimeRowView, RowSkeleton } from "../features/catalog/ui/AnimeRowView.tsx";
import { HeroView } from "../features/catalog/ui/HeroView.tsx";
import type { ResourceStore } from "../lib/resource-store.ts";
import { useResource } from "../lib/use-resource.ts";
import { Empty } from "../ui/Empty.tsx";

type HomeProps = { catalog: Catalog; store: ResourceStore };

function GenresRow({ catalog, store }: HomeProps) {
  const { data } = useResource(store, "genres", () => catalog.genres(), { persist: true });
  if (!data || data.length === 0) return null;

  return (
    <section className="flex flex-wrap gap-2">
      {data.map((card) => (
        <Link
          key={card.genre}
          to={`/genre/${encodeURIComponent(card.genre)}`}
          className="rounded-full border border-line px-3 py-1 text-sm text-muted transition hover:border-primary/60 hover:text-primary"
        >
          {card.genre}
        </Link>
      ))}
    </section>
  );
}

export function CatalogHomePage({ catalog, store }: HomeProps) {
  const { data, loading, error, outdated, reload } = useResource(
    store,
    "home",
    () => catalog.home(),
    { persist: true },
  );

  if (!data && loading) {
    return (
      <div className="flex flex-col gap-10">
        <div className="h-64 rounded-2xl bg-surface sm:h-80" />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <Empty
        title={outdated ? "Version trop ancienne" : "Catalogue indisponible"}
        note={error ?? "Le catalogue n'a rien renvoyé pour le moment."}
        onRetry={outdated ? undefined : reload}
      />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {data.hero[0] && <HeroView item={data.hero[0]} />}
      <GenresRow catalog={catalog} store={store} />
      {data.rows.map((row) => (
        <AnimeRowView key={row.key} row={row} />
      ))}
      {error && <p className="text-center text-xs text-muted/70">{error}</p>}
    </div>
  );
}
