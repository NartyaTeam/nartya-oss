import type { SupabaseClient } from "@supabase/supabase-js";

export type Status = "watching" | "planned" | "completed" | "dropped";

export const STATUSES: { key: Status; label: string }[] = [
  { key: "watching", label: "En cours" },
  { key: "planned", label: "À voir" },
  { key: "completed", label: "Terminé" },
  { key: "dropped", label: "Abandonné" },
];

export type Entry = {
  slug: string;
  title: string;
  cover: string | null;
  status: Status;
  // When the status last changed: Supabase sets it on every change of status.
  changedAt: string | null;
};

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const isStatus = (value: unknown): value is Status =>
  STATUSES.some((status) => status.key === value);

// Older rows can hold one anime twice, under two slugs the catalog once used for it; the
// first, in the list's own order, is the one kept.
export function readEntries(rows: unknown): Entry[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  return rows.flatMap((row: unknown) => {
    if (typeof row !== "object" || row === null) return [];
    const read = row as Record<string, unknown>;
    const slug = text(read["anime_slug"]);
    const status = read["status"];
    if (!slug || !isStatus(status)) return [];
    const title = text(read["anime_title"]) ?? slug;
    const key = title.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [
      {
        slug,
        title,
        cover: text(read["anime_cover"]),
        status,
        changedAt: text(read["updated_at"]),
      },
    ];
  });
}

const SINCE: Record<Status, string> = {
  watching: "En cours depuis le",
  planned: "À voir depuis le",
  completed: "Terminé le",
  dropped: "Abandonné le",
};

// The year is only written when it is not this one: "Terminé le 12 janvier".
export function statusLine(status: Status, changedAt: string | null, now: Date): string | null {
  if (!changedAt) return null;
  const at = new Date(changedAt);
  if (Number.isNaN(at.getTime())) return null;
  const day = at.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    ...(at.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
  return `${SINCE[status]} ${day}`;
}

// Past the opening credits, or the whole of an episode shorter than that: a real start,
// not a source that loaded and was left at once.
const STARTED_AFTER_SECONDS = 120;
const FINISHED_PERCENT = 90;

export function hasStarted(seconds: number, duration: number): boolean {
  if (seconds >= STARTED_AFTER_SECONDS) return true;
  return duration > 0 && (seconds / duration) * 100 >= FINISHED_PERCENT;
}

export function countByStatus(entries: Entry[]): Record<Status, number> {
  const counts: Record<Status, number> = { watching: 0, planned: 0, completed: 0, dropped: 0 };
  for (const entry of entries) counts[entry.status] += 1;
  return counts;
}

export function createLists(client: SupabaseClient) {
  return {
    list: async (userId: string): Promise<Entry[] | null> => {
      const { data, error } = await client
        .from("anime_lists")
        .select("anime_slug, status, anime_title, anime_cover, updated_at")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("updated_at", { ascending: false });
      return error ? null : readEntries(data);
    },

    // The function also dates the entry: started when watched, finished when completed.
    set: async (entry: Entry): Promise<boolean> => {
      const { error } = await client.rpc("set_anime_status", {
        p_slug: entry.slug,
        p_status: entry.status,
        p_title: entry.title,
        p_cover: entry.cover,
      });
      return error === null;
    },

    remove: async (userId: string, slug: string): Promise<boolean> => {
      const { error } = await client
        .from("anime_lists")
        .delete()
        .eq("user_id", userId)
        .eq("anime_slug", slug);
      return error === null;
    },

    reorder: async (status: Status, slugs: string[]): Promise<boolean> => {
      const { error } = await client.rpc("reorder_anime_list", {
        p_status: status,
        p_slugs: slugs,
      });
      return error === null;
    },
  };
}

export type Lists = ReturnType<typeof createLists>;
