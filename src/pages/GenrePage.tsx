import { useState } from "react";
import { useParams } from "react-router-dom";
import type { Catalog } from "../features/catalog/catalog.ts";
import { ResultsGrid } from "../features/catalog/ui/ResultsGrid.tsx";
import type { ResourceStore } from "../lib/resource-store.ts";
import { useResource } from "../lib/use-resource.ts";
import { Button } from "../ui/Button.tsx";
import { Empty } from "../ui/Empty.tsx";

type GenreProps = { catalog: Catalog; store: ResourceStore };

export function GenrePage({ catalog, store }: GenreProps) {
  const { genre = "" } = useParams();
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useResource(
    store,
    `genre:${genre}:${String(page)}`,
    () => catalog.byGenre(genre, page),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{genre}</h1>

      {loading && !data && <p className="text-sm text-neutral-500">Chargement…</p>}
      {data && data.items.length > 0 && <ResultsGrid items={data.items} />}
      {data && data.items.length === 0 && (
        <Empty title="Rien dans ce genre" note="Le catalogue n'a rien à montrer ici." />
      )}
      {!data && error && <Empty title="Chargement impossible" note={error} onRetry={reload} />}

      {data?.hasMore && (
        <Button variant="ghost" onClick={() => setPage(page + 1)}>
          Page suivante
        </Button>
      )}
    </div>
  );
}
