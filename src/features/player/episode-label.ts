import { seasonKind } from "../anime/season-groups.ts";

// A season is named "Saison 2" or "Saga 1 East Blue": the first number is its own. A film or
// a special has none, and takes its place in the list instead.
export function seasonNumber(name: string, index: number): number {
  const found = /\d+/.exec(name);
  return found ? Number(found[0]) : index + 1;
}

export function episodeLabel(
  seasonName: string,
  seasonIndex: number,
  episode: { shown: string; title: string },
): string {
  const kind = seasonKind(seasonName);
  if (kind === "films" || kind === "specials" || kind === "other")
    return `${seasonName} — ${episode.title}`;
  const head = `S${String(seasonNumber(seasonName, seasonIndex))} EP${episode.shown}`;
  return episode.title ? `${head} — ${episode.title}` : head;
}
