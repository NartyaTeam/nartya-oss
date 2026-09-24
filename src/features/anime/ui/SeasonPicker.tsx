import { ArrowDownUp, Search, X } from "lucide-react";
import { Select } from "../../../ui/Select.tsx";
import { flagFor } from "../flags.ts";
import { languageLabel } from "../languages.ts";
import { choiceOf } from "../season.ts";
import { groupSeasons } from "../season-groups.ts";
import type { Season, Source } from "../types.ts";
import { Flag } from "./Flag.tsx";

export const AUTO_SOURCE = "auto";

type PickerProps = {
  seasons: Season[];
  season: string;
  onSeason: (id: string) => void;
  languages: string[];
  lang: string;
  onLang: (lang: string) => void;
  country: string | null;
  sources: Source[];
  source: string;
  onSource: (slot: string) => void;
  search: string;
  onSearch: (term: string) => void;
  reversed: boolean;
  onReverse: () => void;
};

export function SeasonPicker(props: PickerProps) {
  const { seasons, languages, sources, search } = props;
  const groups = groupSeasons(seasons);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2.5">
      {seasons.length > 1 && (
        <Select
          label="Saison"
          value={props.season}
          onValueChange={props.onSeason}
          className="min-w-[9rem]"
          options={groups.flatMap((group) =>
            group.seasons.map((season) => ({
              value: season.id,
              label: season.name,
              group: groups.length > 1 ? group.label : undefined,
            })),
          )}
        />
      )}

      {languages.length > 1 && (
        <Select
          label="Langue"
          value={props.lang}
          onValueChange={props.onLang}
          className="min-w-[8.5rem]"
          options={languages.map((lang) => ({
            value: lang,
            label: languageLabel(lang),
            icon: <Flag code={flagFor(lang, props.country)} />,
          }))}
        />
      )}

      {sources.length > 1 && (
        <Select
          label="Source vidéo"
          value={props.source}
          onValueChange={props.onSource}
          className="min-w-[9.5rem]"
          options={[
            { value: AUTO_SOURCE, label: "Source automatique" },
            ...sources.map((source) => ({
              value: choiceOf(source),
              label: source.recommended ? `${source.label} (recommandée)` : source.label,
            })),
          ]}
        />
      )}

      {/* The search keeps shrinking while there is room, and drops to its own full width line
          rather than ending up cramped under the selectors. */}
      <div className="ml-auto flex min-w-0 flex-1 basis-72 items-center gap-2.5 sm:max-w-sm">
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-md bg-surface px-3.5 ring-1 ring-line transition-colors focus-within:ring-primary/60">
          <Search size={16} className="shrink-0 text-muted" />
          <input
            value={search}
            onChange={(event) => props.onSearch(event.target.value)}
            placeholder="Rechercher un épisode (n° ou titre)…"
            className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
          />
          {search && (
            <button
              onClick={() => props.onSearch("")}
              title="Effacer"
              className="shrink-0 text-muted transition-colors hover:text-text"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <button
          onClick={props.onReverse}
          title={props.reversed ? "Ordre décroissant" : "Ordre croissant"}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ring-1 ring-line transition-colors ${
            props.reversed ? "bg-primary text-primary-fg" : "bg-surface text-muted hover:text-text"
          }`}
        >
          <ArrowDownUp size={16} />
        </button>
      </div>
    </div>
  );
}
