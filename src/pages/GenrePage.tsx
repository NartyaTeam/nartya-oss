import { useState } from "react";
import { useParams } from "react-router-dom";
import type { Catalog } from "../features/catalog/catalog.ts";
import { ResultsGrid } from "../features/catalog/ui/ResultsGrid.tsx";
import type { ResourceStore } from "../lib/resource-store.ts";
import { useResource } from "../lib/use-resource.ts";
import { Empty } from "../ui/Empty.tsx";
import { Pager } from "../ui/Pager.tsx";

type GenreProps = { catalog: Catalog; store: ResourceStore };

export function GenrePage({ catalog, store }: GenreProps) {
  const { genre = "" } = useParams();
  // Paging belongs to the genre being read: moving to another one starts at its first page
  // rather than asking for page seven of something that may only have two.
  const [paging, setPaging] = useState({ genre, page: 1 });
  const page = paging.genre === genre ? paging.page : 1;
  const { data, loading, error, reload } = useResource(
    store,
    `genre:${genre}:${String(page)}`,
    () => catalog.byGenre(genre, page),
  );

  return (
    <div className="flex flex-col gap-6 px-4 pb-24 pt-24 sm:px-8">
      <h1 className="font-display text-3xl font-black">{genre}</h1>

      {loading && !data && <p className="text-sm text-muted">Chargement…</p>}
      {data && data.items.length > 0 && <ResultsGrid items={data.items} />}
      {data && data.items.length === 0 && (
        <Empty title="Rien dans ce genre" note="Le catalogue n'a rien à montrer ici." />
      )}
      {!data && error && <Empty title="Chargement impossible" note={error} onRetry={reload} />}

      {data && data.items.length > 0 && (
        <Pager
          page={page}
          hasMore={data.hasMore}
          onGo={(next) => setPaging({ genre, page: next })}
        />
      )}
    </div>
  );
}
