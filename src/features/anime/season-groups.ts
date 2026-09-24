import type { Season } from "./types.ts";

export type SeasonGroup = { label: string; seasons: Season[] };

type Kind = "main" | "kai" | "films" | "specials" | "other";

const LABELS: Record<Kind, string> = {
  main: "Saisons",
  kai: "Kai",
  films: "Films",
  specials: "OAV & spéciaux",
  other: "Autres",
};
const ORDER: Kind[] = ["main", "kai", "films", "specials", "other"];

const NUMBERED = /\b(?:saison|saga|partie|version)\s*(\d+(?:[.,]\d+)?)/i;

function kindOf(name: string): Kind {
  const lower = name.trim().toLowerCase();
  if (/^kai\b/.test(lower)) return "kai";
  if (/^films?\b/.test(lower)) return "films";
  if (/^(?:oav|ova|oad|sp[ée]cial)/.test(lower)) return "specials";
  if (NUMBERED.test(lower) || /^(?:avec|sans) fillers\b/.test(lower)) return "main";
  return "other";
}

// "100 Years Quest Saison 1" is a first season, not a hundredth: only the number that follows
// the word counts. Without one, the api's order stands.
function numberOf(name: string): number {
  const found = NUMBERED.exec(name);
  return found?.[1] ? Number(found[1].replace(",", ".")) : 0;
}

export function groupSeasons(seasons: Season[]): SeasonGroup[] {
  return ORDER.map((kind) => {
    const inGroup = seasons.filter((season) => kindOf(season.name) === kind);
    if (kind === "main" || kind === "kai") {
      inGroup.sort((a, b) => numberOf(a.name) - numberOf(b.name));
    }
    return { label: LABELS[kind], seasons: inGroup };
  }).filter((group) => group.seasons.length > 0);
}

export function firstSeason(seasons: Season[]): Season | undefined {
  return groupSeasons(seasons)[0]?.seasons[0];
}
