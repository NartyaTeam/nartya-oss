import { create } from "zustand";
import type { Favorite, Favorites } from "./favorites.ts";

export type Failure = { slug: string | null; message: string };

type FavoritesState = {
  userId: string | null;
  items: Favorite[] | null;
  failed: Failure | null;
  load: (api: Favorites, userId: string) => Promise<void>;
  toggle: (api: Favorites, favorite: Favorite) => Promise<void>;
  reorder: (api: Favorites, slugs: string[]) => Promise<void>;
};

const LOAD_FAILED = "Impossible de charger les favoris.";
const TOGGLE_FAILED = "Impossible de mettre à jour les favoris.";
const REORDER_FAILED = "Impossible d'enregistrer le nouvel ordre.";

export const useFavorites = create<FavoritesState>((set, get) => ({
  userId: null,
  items: null,
  failed: null,

  load: async (api, userId) => {
    if (get().userId === userId && get().items) return;
    set({ userId, items: null, failed: null });
    const items = await api.list(userId);
    // Signed out, or someone else signed in, while the list was on its way.
    if (get().userId !== userId || get().items) return;
    set(items ? { items } : { failed: { slug: null, message: LOAD_FAILED } });
  },

  toggle: async (api, favorite) => {
    const { userId, items } = get();
    if (!userId || !items) return;
    const present = items.some((entry) => entry.slug === favorite.slug);
    const next = present
      ? items.filter((entry) => entry.slug !== favorite.slug)
      : [favorite, ...items];
    set({ items: next, failed: null });

    const saved = present
      ? await api.remove(userId, favorite.slug)
      : await api.add(userId, favorite);
    if (saved || get().userId !== userId) return;
    set((state) => ({
      items: present
        ? [favorite, ...(state.items ?? [])]
        : (state.items ?? []).filter((entry) => entry.slug !== favorite.slug),
      failed: { slug: favorite.slug, message: TOGGLE_FAILED },
    }));
  },

  reorder: async (api, slugs) => {
    const { userId, items } = get();
    if (!userId || !items) return;
    const bySlug = new Map(items.map((entry) => [entry.slug, entry]));
    set({
      items: slugs.flatMap((slug) => bySlug.get(slug) ?? []),
      failed: null,
    });
    if (await api.reorder(slugs)) return;
    if (get().userId === userId) set({ items, failed: { slug: null, message: REORDER_FAILED } });
  },
}));
