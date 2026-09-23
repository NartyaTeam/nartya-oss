// A season is named "Saison 2" or "Saga 1 East Blue": the first number is its own. A film or
// a special has none, and takes its place in the list instead.
export function seasonNumber(name: string, index: number): number {
  const found = /\d+/.exec(name);
  return found ? Number(found[0]) : index + 1;
}

export function episodeLabel(
  seasonName: string,
  seasonIndex: number,
  episode: { number: number; title: string },
): string {
  const head = `S${String(seasonNumber(seasonName, seasonIndex))} EP${String(episode.number)}`;
  return episode.title ? `${head} — ${episode.title}` : head;
}
