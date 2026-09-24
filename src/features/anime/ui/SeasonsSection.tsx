import { useState } from "react";
import { availableLanguages, choiceOf, episodesIn, searchEpisodes, sourcesFor } from "../season.ts";
import type { Watched } from "../../player/progress.ts";
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
  watched: Record<string, Watched>;
  watchUrl: (episode: Episode, source: string) => string;
};

export function SeasonsSection(props: SeasonsProps) {
  const { page, episodes, lang, loading, error } = props;
  // A search belongs to the season it was typed in: carried over, it would show "nothing
  // found" on a season that is full. The order is a preference, and stays.
  const [typed, setTyped] = useState({ season: props.seasonId, term: "" });
  const search = typed.season === props.seasonId ? typed.term : "";
  const [reversed, setReversed] = useState(false);

  const languages = availableLanguages(episodes);
  const sources = sourcesFor(episodes, lang);
  const known = sources.some((entry) => choiceOf(entry) === props.source);

  const found = searchEpisodes(episodesIn(episodes, lang), search);
  const shown = reversed ? [...found].reverse() : found;

  return (
    <section className="mt-10 px-4 md:px-14">
      <SeasonPicker
        seasons={page.seasons}
        season={props.seasonId}
        onSeason={(id) => props.onChoose({ saison: id })}
        languages={languages}
        lang={lang}
        onLang={(value) => props.onChoose({ lang: value })}
        country={page.meta?.country ?? null}
        sources={sources}
        source={known ? props.source : AUTO_SOURCE}
        onSource={(value) => props.onChoose({ src: value })}
        search={search}
        onSearch={(term) => setTyped({ season: props.seasonId, term })}
        reversed={reversed}
        onReverse={() => setReversed(!reversed)}
      />

      {loading && shown.length === 0 && (
        <p className="text-sm text-muted">Chargement des épisodes…</p>
      )}

      {shown.length > 0 && (
        <EpisodeList
          episodes={shown}
          lang={lang}
          country={page.meta?.country ?? null}
          poster={page.images?.poster ?? page.anime.poster}
          seasonId={props.seasonId}
          watched={props.watched}
          watchUrl={(episode) => props.watchUrl(episode, known ? props.source : AUTO_SOURCE)}
        />
      )}

      {!loading && shown.length === 0 && (
        <Empty
          title={search ? "Aucun épisode trouvé" : "Aucun épisode"}
          note={
            search
              ? `Rien ne correspond à « ${search} » dans cette saison.`
              : (error ?? "Cette saison n'a rien de disponible pour le moment.")
          }
          onRetry={error && !search ? props.onRetry : undefined}
        />
      )}
    </section>
  );
}
