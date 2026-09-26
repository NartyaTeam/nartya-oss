import type { SupabaseClient } from "@supabase/supabase-js";

export type Favorite = {
  slug: string;
  title: string;
  cover: string | null;
  genre: string | null;
};

export const UNSORTED = "Non classé";

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export function readFavorites(rows: unknown): Favorite[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row: unknown) => {
    if (typeof row !== "object" || row === null) return [];
    const read = row as Record<string, unknown>;
    const slug = text(read["anime_slug"]);
    if (!slug) return [];
    return [
      {
        slug,
        title: text(read["anime_title"]) ?? slug,
        cover: text(read["anime_cover"]),
        genre: text(read["genre"]),
      },
    ];
  });
}

export function matching(favorites: Favorite[], query: string): Favorite[] {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return favorites;
  return favorites.filter((favorite) => favorite.title.toLowerCase().includes(wanted));
}

// The largest genres first, and the favorites no genre was known for at the very end.
export function byGenre(favorites: Favorite[]): [string, Favorite[]][] {
  const groups = new Map<string, Favorite[]>();
  for (const favorite of favorites) {
    const genre = favorite.genre ?? UNSORTED;
    groups.set(genre, [...(groups.get(genre) ?? []), favorite]);
  }
  return [...groups.entries()].sort(([a, first], [b, second]) => {
    if (a === UNSORTED) return 1;
    if (b === UNSORTED) return -1;
    return second.length - first.length;
  });
}

export function createFavorites(client: SupabaseClient) {
  return {
    list: async (userId: string): Promise<Favorite[] | null> => {
      const { data, error } = await client
        .from("favorites")
        .select("anime_slug, anime_title, anime_cover, genre")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("added_at", { ascending: false });
      return error ? null : readFavorites(data);
    },

    add: async (userId: string, favorite: Favorite): Promise<boolean> => {
      const { error } = await client.from("favorites").upsert(
        {
          user_id: userId,
          anime_slug: favorite.slug,
          anime_title: favorite.title,
          anime_cover: favorite.cover,
          genre: favorite.genre,
        },
        { onConflict: "user_id,anime_slug" },
      );
      return error === null;
    },

    remove: async (userId: string, slug: string): Promise<boolean> => {
      const { error } = await client
        .from("favorites")
        .delete()
        .eq("user_id", userId)
        .eq("anime_slug", slug);
      return error === null;
    },

    reorder: async (slugs: string[]): Promise<boolean> => {
      const { error } = await client.rpc("reorder_favorites", { p_slugs: slugs });
      return error === null;
    },
  };
}

export type Favorites = ReturnType<typeof createFavorites>;
