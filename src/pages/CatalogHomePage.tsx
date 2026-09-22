import type { Catalog } from "../features/catalog/catalog.ts";
import { AnimeRowView, RowSkeleton, TopTenRowView } from "../features/catalog/ui/AnimeRowView.tsx";
import { GenresRowView } from "../features/catalog/ui/GenresRowView.tsx";
import { HeroView } from "../features/catalog/ui/HeroView.tsx";
import type { ResourceStore } from "../lib/resource-store.ts";
import { useResource } from "../lib/use-resource.ts";
import { Empty } from "../ui/Empty.tsx";

type HomeProps = { catalog: Catalog; store: ResourceStore };

function GenresRow({ catalog, store }: HomeProps) {
  const { data } = useResource(store, "genres", () => catalog.genres(), { persist: true });
  if (!data || data.length === 0) return null;
  return <GenresRowView genres={data} />;
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
      <div className="pb-24">
        <div className="px-4 pt-3 md:h-[70vh] md:min-h-[500px] md:px-0 md:pt-0">
          <div className="skeleton h-[53svh] min-h-[29rem] max-h-[33rem] w-full rounded-2xl md:h-full md:max-h-none md:min-h-0 md:rounded-none" />
        </div>
        <div className="space-y-12 py-12">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="px-4 pt-16 sm:px-8">
        <Empty
          title={outdated ? "Version trop ancienne" : "Catalogue indisponible"}
          note={error ?? "Le catalogue n'a rien renvoyé pour le moment."}
          onRetry={outdated ? undefined : reload}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-24">
      <HeroView items={data.hero} />
      <div className="relative z-10 mt-1 space-y-8 md:-mt-10 md:space-y-12">
        <GenresRow catalog={catalog} store={store} />
        {data.rows.map((row) =>
          row.variant === "numbered" ? (
            <TopTenRowView key={row.key} row={row} />
          ) : (
            <AnimeRowView key={row.key} row={row} />
          ),
        )}
        {error && <p className="text-center text-xs text-muted/70">{error}</p>}
      </div>
    </div>
  );
}
