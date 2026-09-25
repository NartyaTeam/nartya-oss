import type { SupabaseClient } from "@supabase/supabase-js";

export const COMPLETION_THRESHOLD = 90;
// Two saves closer than this are one: a flurry of pause and play would otherwise flood
// the table. A forced save, on an episode change or on the way out, ignores it.
export const MIN_SAVE_GAP_MS = 5_000;
export const SAVE_EVERY_MS = 30_000;

export type Watched = { percent: number; completed: boolean };
export type Resume = {
  seasonId: string;
  episodeNumber: number;
  language: string;
  percent: number;
  completed: boolean;
};

export function episodeKey(
  slug: string,
  seasonId: string,
  episodeNumber: number,
  language: string,
): string {
  return `${slug}:${seasonId}:${String(episodeNumber)}:${language}`;
}

export function watchedOf(positionSeconds: number, duration: number): Watched {
  const percent = duration > 0 ? Math.min((positionSeconds / duration) * 100, 100) : 0;
  return { percent, completed: percent >= COMPLETION_THRESHOLD };
}

// "Sans titre" is what the screen shows before the card has loaded; writing it would put
// a placeholder in the viewer's own history.
export function cleanTitle(title: string | null): string | null {
  const trimmed = title?.trim() ?? "";
  return trimmed && trimmed !== "Sans titre" ? trimmed : null;
}

export function shouldSave(lastSavedAt: number | null, now: number, force: boolean): boolean {
  if (force || lastSavedAt === null) return true;
  return now - lastSavedAt >= MIN_SAVE_GAP_MS;
}

export type SaveWhat = {
  slug: string;
  seasonId: string;
  episodeNumber: number;
  language: string;
  positionSeconds: number;
  duration: number;
  title: string | null;
  cover: string | null;
};

export function rowFor(userId: string, what: SaveWhat, at: string): Record<string, unknown> {
  const { percent, completed } = watchedOf(what.positionSeconds, what.duration);
  return {
    user_id: userId,
    episode_key: episodeKey(what.slug, what.seasonId, what.episodeNumber, what.language),
    anime_slug: what.slug,
    anime_title: cleanTitle(what.title),
    anime_cover: what.cover,
    season_id: what.seasonId,
    episode_number: what.episodeNumber,
    language: what.language,
    position_seconds: what.positionSeconds,
    duration: what.duration,
    progress_percent: percent,
    completed,
    // Watching it again is what puts an anime back in the resume row.
    hidden_from_resume: false,
    updated_at: at,
  };
}

export function readResume(row: unknown): Resume | null {
  if (typeof row !== "object" || row === null) return null;
  const read = row as Record<string, unknown>;
  const seasonId = typeof read["season_id"] === "string" ? read["season_id"] : null;
  const episodeNumber = typeof read["episode_number"] === "number" ? read["episode_number"] : null;
  if (seasonId === null || episodeNumber === null) return null;

  return {
    seasonId,
    episodeNumber,
    language: typeof read["language"] === "string" ? read["language"] : "",
    percent: Math.round(
      typeof read["progress_percent"] === "number" ? read["progress_percent"] : 0,
    ),
    completed: read["completed"] === true,
  };
}

// Several languages of one episode each carry their own row; the screen shows one tick,
// so the furthest of them is what counts.
export function foldByEpisode(rows: unknown): Record<string, Watched> {
  if (!Array.isArray(rows)) return {};
  const map: Record<string, Watched> = {};
  for (const entry of rows) {
    if (typeof entry !== "object" || entry === null) continue;
    const read = entry as Record<string, unknown>;
    const seasonId = typeof read["season_id"] === "string" ? read["season_id"] : null;
    const episodeNumber =
      typeof read["episode_number"] === "number" ? read["episode_number"] : null;
    if (seasonId === null || episodeNumber === null) continue;

    const key = `${seasonId}:${String(episodeNumber)}`;
    const percent = Math.round(
      typeof read["progress_percent"] === "number" ? read["progress_percent"] : 0,
    );
    const held = map[key];
    if (!held || percent > held.percent)
      map[key] = { percent, completed: read["completed"] === true };
  }
  return map;
}

export function createProgress(client: SupabaseClient) {
  let lastSavedAt: number | null = null;

  return {
    resumeFor: async (slug: string, userId: string): Promise<Resume | null> => {
      const { data } = await client
        .from("episode_progress")
        .select("season_id, episode_number, language, progress_percent, completed")
        .eq("user_id", userId)
        .eq("anime_slug", slug)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return readResume(data);
    },

    positionFor: async (userId: string, key: string): Promise<number> => {
      const { data } = await client
        .from("episode_progress")
        .select("position_seconds, completed")
        .eq("user_id", userId)
        .eq("episode_key", key)
        .maybeSingle();
      const row = data as { position_seconds?: unknown; completed?: unknown } | null;
      // A finished episode starts again from the top rather than on its credits.
      if (!row || row.completed === true) return 0;
      return typeof row.position_seconds === "number" ? row.position_seconds : 0;
    },

    watchedIn: async (slug: string, userId: string): Promise<Record<string, Watched>> => {
      const { data } = await client
        .from("episode_progress")
        .select("season_id, episode_number, progress_percent, completed")
        .eq("user_id", userId)
        .eq("anime_slug", slug);
      return foldByEpisode(data);
    },

    save: async (userId: string, what: SaveWhat, force = false): Promise<void> => {
      const now = Date.now();
      if (!shouldSave(lastSavedAt, now, force)) return;
      lastSavedAt = now;
      await client
        .from("episode_progress")
        .upsert(rowFor(userId, what, new Date(now).toISOString()), {
          onConflict: "user_id,episode_key",
        });
    },
  };
}

export type Progress = ReturnType<typeof createProgress>;
