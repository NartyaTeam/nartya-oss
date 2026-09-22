import type { Episode, Source } from "./types.ts";

export function availableLanguages(episodes: Episode[]): string[] {
  const seen = new Set<string>();
  for (const episode of episodes) {
    for (const lang of Object.keys(episode.sources)) seen.add(lang);
  }
  return [...seen];
}

// A season's players are not the same on every episode: a host added halfway through the
// run would be missing from a list read off the first one.
export function sourcesFor(episodes: Episode[], lang: string): Source[] {
  const bySlot = new Map<string, Source>();
  for (const episode of episodes) {
    for (const source of episode.sources[lang] ?? []) {
      if (!bySlot.has(source.slot)) bySlot.set(source.slot, source);
    }
  }
  return [...bySlot.values()].sort((a, b) => a.rank - b.rank);
}

export function episodesIn(episodes: Episode[], lang: string): Episode[] {
  return episodes.filter((episode) => (episode.sources[lang] ?? []).length > 0);
}
