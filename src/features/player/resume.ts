import type { Resume } from "./progress.ts";
import { AUTO } from "./sources.ts";

export type ResumeLink = { to: string; label: string };

export function watchLink(
  slug: string,
  seasonId: string,
  episode: number,
  lang: string,
  source: string = AUTO,
): string {
  const query = new URLSearchParams({ saison: seasonId, ep: String(episode), lang });
  if (source !== AUTO) query.set("src", source);
  return `/watch/${encodeURIComponent(slug)}?${query.toString()}`;
}

// Nothing watched yet is starting, not resuming, and a finished episode points at the one
// after it rather than at its own credits again.
export function resumeLink(
  slug: string,
  last: Resume | null,
  firstSeason: string | null,
  lang: string,
): ResumeLink | null {
  if (last) {
    const episode = last.completed ? last.episodeNumber + 1 : last.episodeNumber;
    return {
      to: watchLink(slug, last.seasonId, episode, last.language || lang),
      label: last.completed
        ? `Épisode ${String(episode)}`
        : `Reprendre l'épisode ${String(episode)}`,
    };
  }
  return firstSeason ? { to: watchLink(slug, firstSeason, 1, lang), label: "Commencer" } : null;
}
