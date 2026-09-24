import type { DownloadRequest } from "../shared/downloads.ts";

const text = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const optional = (value: unknown): string | null => (typeof value === "string" ? value : null);

export function readDownloadRequest(value: unknown): DownloadRequest | null {
  if (typeof value !== "object" || value === null) return null;
  const bag = value as Record<string, unknown>;
  const token = text(bag["token"]);
  const slug = text(bag["slug"]);
  const seasonId = text(bag["seasonId"]);
  const lang = text(bag["lang"]);
  const ep = bag["ep"];
  if (!token || !slug || !seasonId || !lang) return null;
  if (typeof ep !== "number" || !Number.isFinite(ep)) return null;

  return {
    token,
    slug,
    seasonId,
    ep,
    lang,
    animeTitle: text(bag["animeTitle"]) ?? slug,
    animeCover: optional(bag["animeCover"]),
    epThumb: optional(bag["epThumb"]),
    epTitle: optional(bag["epTitle"]),
    seasonName: optional(bag["seasonName"]),
  };
}

export function readSeason(
  value: unknown,
): { slug: string; seasonId: string; lang: string } | null {
  if (typeof value !== "object" || value === null) return null;
  const bag = value as Record<string, unknown>;
  const slug = text(bag["slug"]);
  const seasonId = text(bag["seasonId"]);
  const lang = text(bag["lang"]);
  return slug && seasonId && lang ? { slug, seasonId, lang } : null;
}
