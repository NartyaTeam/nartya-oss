import type { Episode, Source } from "./types.ts";

export function availableLanguages(episodes: Episode[]): string[] {
  const seen = new Set<string>();
  for (const episode of episodes) {
    for (const lang of Object.keys(episode.sources)) seen.add(lang);
  }
  return [...seen];
}

// What a viewer picks is a host: the same "Source A" in every language and season, where
// the api's slot names only a column of one season's page.
export function choiceOf(source: Source): string {
  return source.key || source.slot;
}

// A season's players are not the same on every episode: a host added halfway through the
// run would be missing from a list read off the first one.
export function sourcesFor(episodes: Episode[], lang: string): Source[] {
  const byChoice = new Map<string, Source>();
  for (const episode of episodes) {
    for (const source of episode.sources[lang] ?? []) {
      const choice = choiceOf(source);
      const held = byChoice.get(choice);
      if (!held || source.rank < held.rank) byChoice.set(choice, source);
    }
  }
  return [...byChoice.values()].sort((a, b) => a.rank - b.rank);
}

export function episodesIn(episodes: Episode[], lang: string): Episode[] {
  return episodes.filter((episode) => (episode.sources[lang] ?? []).length > 0);
}

// A number searches for that episode alone: an untranslated season titles its episodes
// "Épisode N", so a loose match on 12 would drag back 112 and 120 with it.
export function searchEpisodes(episodes: Episode[], term: string): Episode[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return episodes;
  if (/^\d+$/.test(needle)) {
    return episodes.filter((episode) => String(episode.number) === needle);
  }
  return episodes.filter((episode) => episode.title.toLowerCase().includes(needle));
}
