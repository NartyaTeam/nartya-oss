import type { Presence } from "../../../shared/presence.ts";

export type Doing =
  | { kind: "browsing" }
  | { kind: "choosing"; slug: string; title: string }
  | { kind: "watching"; slug: string; title: string; episode: number; season: number };

const APP_TEXT = "Nartya — Streaming Anime";

function buttonsFor(site: string | null, slug: string | null): Presence["buttons"] {
  if (!site) return [];
  const visit = { label: "Visiter le site", url: site };
  if (!slug) return [visit];
  return [
    { label: "Regarder cet anime", url: `${site}/open?anime=${encodeURIComponent(slug)}` },
    visit,
  ];
}

export function presenceFor(doing: Doing, site: string | null): Presence {
  switch (doing.kind) {
    case "browsing":
      return {
        details: "Navigue sur Nartya",
        state: "Exploration du catalogue",
        largeText: APP_TEXT,
        buttons: buttonsFor(site, null),
      };
    case "choosing":
      return {
        details: "Choix d'un épisode",
        state: doing.title,
        largeText: doing.title,
        buttons: buttonsFor(site, doing.slug),
      };
    case "watching": {
      const season = doing.season > 1 ? ` · Saison ${String(doing.season)}` : "";
      return {
        details: `Regarde ${doing.title}`,
        state: `Épisode ${String(doing.episode)}${season}`,
        largeText: doing.title,
        buttons: buttonsFor(site, doing.slug),
      };
    }
  }
}
