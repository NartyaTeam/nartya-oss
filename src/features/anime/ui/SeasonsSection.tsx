import { availableLanguages, episodesIn, sourcesFor } from "../season.ts";
import type { AnimePage, Episode } from "../types.ts";
import { Empty } from "../../../ui/Empty.tsx";
import { EpisodeList } from "./EpisodeList.tsx";
import { AUTO_SOURCE, SeasonPicker } from "./SeasonPicker.tsx";

type SeasonsProps = {
  page: AnimePage;
  seasonId: string;
  episodes: Episode[];
  lang: string;
  source: string;
  loading: boolean;
  error: string | null;
  onChoose: (patch: Record<string, string>) => void;
  onRetry: () => void;
};

export function SeasonsSection(props: SeasonsProps) {
  const { page, episodes, lang, loading, error } = props;
  const languages = availableLanguages(episodes);
  const shown = episodesIn(episodes, lang);
  const sources = sourcesFor(episodes, lang);
  const known = sources.some((entry) => entry.slot === props.source);

  return (
    <section className="mt-10 px-4 md:px-14">
      <SeasonPicker
        seasons={page.seasons}
        season={props.seasonId}
        onSeason={(id) => props.onChoose({ saison: id })}
        languages={languages}
        lang={lang}
        onLang={(value) => props.onChoose({ lang: value })}
        sources={sources}
        source={known ? props.source : AUTO_SOURCE}
        onSource={(value) => props.onChoose({ src: value })}
      />

      {loading && shown.length === 0 && (
        <p className="text-sm text-muted">Chargement des épisodes…</p>
      )}

      {shown.length > 0 && (
        <EpisodeList
          episodes={shown}
          lang={lang}
          poster={page.images?.poster ?? page.anime.poster}
        />
      )}

      {!loading && shown.length === 0 && (
        <Empty
          title="Aucun épisode"
          note={error ?? "Cette saison n'a rien de disponible pour le moment."}
          onRetry={error ? props.onRetry : undefined}
        />
      )}
    </section>
  );
}
