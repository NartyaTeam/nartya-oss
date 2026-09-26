import { create } from "zustand";
import type { Entry, Lists, Status } from "./lists.ts";

export type Failure = { slug: string | null; message: string };

type ListsState = {
  userId: string | null;
  items: Entry[] | null;
  failed: Failure | null;
  autoTrack: boolean;
  setAutoTrack: (on: boolean) => void;
  load: (api: Lists, userId: string) => Promise<void>;
  place: (api: Lists, entry: Entry) => Promise<void>;
  remove: (api: Lists, slug: string) => Promise<void>;
  reorder: (api: Lists, status: Status, slugs: string[]) => Promise<void>;
  track: (api: Lists, anime: Omit<Entry, "status" | "changedAt">) => Promise<void>;
};

const LOAD_FAILED = "Impossible de charger tes listes.";
const SAVE_FAILED = "Impossible de mettre à jour ta liste.";
const REORDER_FAILED = "Impossible d'enregistrer le nouvel ordre.";
const AUTO_TRACK_KEY = "nartya:lists-auto-track";

function readAutoTrack(): boolean {
  try {
    return globalThis.localStorage.getItem(AUTO_TRACK_KEY) !== "off";
  } catch {
    return true;
  }
}

export const useLists = create<ListsState>((set, get) => ({
  userId: null,
  items: null,
  failed: null,
  autoTrack: readAutoTrack(),

  setAutoTrack: (on) => {
    set({ autoTrack: on });
    try {
      globalThis.localStorage.setItem(AUTO_TRACK_KEY, on ? "on" : "off");
    } catch {
      // Quota or a private window: the choice still holds until the app closes.
    }
  },

  load: async (api, userId) => {
    if (get().userId === userId && get().items) return;
    set({ userId, items: null, failed: null });
    const items = await api.list(userId);
    if (get().userId !== userId || get().items) return;
    set(items ? { items } : { failed: { slug: null, message: LOAD_FAILED } });
  },

  // A status the entry already has is left alone: the function would date it again.
  place: async (api, entry) => {
    const { userId, items } = get();
    if (!userId || !items) return;
    const before = items.find((held) => held.slug === entry.slug);
    if (before?.status === entry.status) return;
    const placed = { ...entry, changedAt: new Date().toISOString() };
    set({
      items: before
        ? items.map((held) => (held.slug === entry.slug ? placed : held))
        : [placed, ...items],
      failed: null,
    });
    if ((await api.set(entry)) || get().userId !== userId) return;
    set((state) => ({
      items: (state.items ?? []).flatMap((held) => {
        if (held.slug !== entry.slug) return [held];
        return before ? [before] : [];
      }),
      failed: { slug: entry.slug, message: SAVE_FAILED },
    }));
  },

  remove: async (api, slug) => {
    const { userId, items } = get();
    const before = items?.find((held) => held.slug === slug);
    if (!userId || !items || !before) return;
    set({ items: items.filter((held) => held.slug !== slug), failed: null });
    if ((await api.remove(userId, slug)) || get().userId !== userId) return;
    set((state) => ({
      items: [before, ...(state.items ?? [])],
      failed: { slug, message: SAVE_FAILED },
    }));
  },

  // An anime already kept somewhere, even under another slug of the same title, stays put.
  track: async (api, anime) => {
    if (!get().autoTrack) return;
    const title = anime.title.toLowerCase();
    const known = get().items?.some(
      (held) => held.slug === anime.slug || held.title.toLowerCase() === title,
    );
    if (known !== false) return;
    await get().place(api, { ...anime, status: "watching", changedAt: null });
  },

  reorder: async (api, status, slugs) => {
    const { userId, items } = get();
    if (!userId || !items) return;
    const bySlug = new Map(items.map((held) => [held.slug, held]));
    set({
      items: [
        ...slugs.flatMap((slug) => bySlug.get(slug) ?? []),
        ...items.filter((held) => held.status !== status),
      ],
      failed: null,
    });
    if (await api.reorder(status, slugs)) return;
    if (get().userId === userId) set({ items, failed: { slug: null, message: REORDER_FAILED } });
  },
}));
