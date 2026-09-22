import { languageLabel } from "../languages.ts";
import type { Season, Source } from "../types.ts";

const SELECT =
  "h-10 rounded-md bg-surface px-3 text-sm text-text outline-none ring-1 ring-line transition-colors hover:bg-surface-2 focus:ring-primary/60";

export const AUTO_SOURCE = "auto";

type PickerProps = {
  seasons: Season[];
  season: string;
  onSeason: (id: string) => void;
  languages: string[];
  lang: string;
  onLang: (lang: string) => void;
  sources: Source[];
  source: string;
  onSource: (slot: string) => void;
};

export function SeasonPicker(props: PickerProps) {
  const { seasons, languages, sources } = props;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2.5">
      {seasons.length > 1 && (
        <select
          aria-label="Saison"
          value={props.season}
          onChange={(event) => props.onSeason(event.target.value)}
          className={`${SELECT} min-w-[9rem]`}
        >
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
            </option>
          ))}
        </select>
      )}

      {languages.length > 1 && (
        <select
          aria-label="Langue"
          value={props.lang}
          onChange={(event) => props.onLang(event.target.value)}
          className={`${SELECT} min-w-[8.5rem]`}
        >
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {languageLabel(lang)}
            </option>
          ))}
        </select>
      )}

      {sources.length > 1 && (
        <select
          aria-label="Source vidéo"
          value={props.source}
          onChange={(event) => props.onSource(event.target.value)}
          className={`${SELECT} min-w-[9.5rem]`}
        >
          <option value={AUTO_SOURCE}>Source automatique</option>
          {sources.map((source) => (
            <option key={source.slot} value={source.slot}>
              {source.label}
              {source.recommended ? " (recommandée)" : ""}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
