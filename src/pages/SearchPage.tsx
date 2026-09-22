import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Catalog } from "../features/catalog/catalog.ts";
import { ResultsGrid } from "../features/catalog/ui/ResultsGrid.tsx";
import type { SearchFilters } from "../features/catalog/types.ts";
import type { ResourceStore } from "../lib/resource-store.ts";
import { useResource } from "../lib/use-resource.ts";
import { Button } from "../ui/Button.tsx";
import { Empty } from "../ui/Empty.tsx";
import { Field } from "../ui/Field.tsx";

const TYPES = [
  { value: "", label: "Tous types" },
  { value: "TV", label: "Série" },
  { value: "MOVIE", label: "Film" },
  { value: "OVA", label: "OAV" },
];

const LANGS = [
  { value: "", label: "Toutes langues" },
  { value: "vostfr", label: "VOSTFR" },
  { value: "vf", label: "VF" },
];

const EMPTY: SearchFilters = { search: "", genres: [], type: "", lang: "", page: 1 };

type SearchProps = { catalog: Catalog; store: ResourceStore };

export function SearchPage({ catalog, store }: SearchProps) {
  const [params] = useSearchParams();
  const query = params.get("q") ?? "";
  const [typed, setTyped] = useState(query);
  const [filters, setFilters] = useState<SearchFilters>({ ...EMPTY, search: query });

  // The top bar hands the term over through the url, so arriving with one runs that search.
  useEffect(() => {
    setTyped(query);
    setFilters({ ...EMPTY, search: query });
  }, [query]);

  // The query is what identifies the read, so the cache key is the query itself.
  const key = `search:${JSON.stringify(filters)}`;
  const { data, loading, error, reload } = useResource(store, key, () => catalog.search(filters));

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    setFilters({ ...filters, search: typed, page: 1 });
  }

  function choose(patch: Partial<SearchFilters>): void {
    setFilters({ ...filters, ...patch, page: 1 });
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-24 pt-24 sm:px-8">
      <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
        <div className="min-w-64 flex-1">
          <Field
            label="Rechercher"
            placeholder="Titre d'un anime"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        <select
          value={filters.type}
          onChange={(event) => choose({ type: event.target.value })}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-text outline-none transition focus:border-primary/70"
        >
          {TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <select
          value={filters.lang}
          onChange={(event) => choose({ lang: event.target.value })}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-text outline-none transition focus:border-primary/70"
        >
          {LANGS.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
        <Button type="submit">Chercher</Button>
      </form>

      {loading && !data && <p className="text-sm text-muted">Recherche…</p>}

      {data && data.items.length > 0 && (
        <>
          <ResultsGrid items={data.items} />
          {data.hasMore && (
            <Button
              variant="ghost"
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            >
              Page suivante
            </Button>
          )}
        </>
      )}

      {data && data.items.length === 0 && (
        <Empty title="Aucun résultat" note="Essaie moins de filtres, ou un autre titre." />
      )}

      {!data && error && <Empty title="Recherche impossible" note={error} onRetry={reload} />}
    </div>
  );
}
