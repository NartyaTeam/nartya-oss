import { create } from "zustand";
import { downloadId, seasonPrefix, type DownloadItem } from "../../../shared/downloads.ts";
import type { DownloadsBridge } from "../../../shared/platform.ts";
import { getPlatform } from "../../lib/platform.ts";
import type { Source } from "../anime/types.ts";
import { createBudget } from "./budget.ts";
import { prepare, type Details } from "./prepare.ts";

export type Job = { details: Details; sources: Source[] };

type DownloadsState = {
  items: Record<string, DownloadItem>;
  // Resolving a source before the main process takes over: no record exists yet.
  preparing: Record<string, true>;
  failed: Record<string, string>;
  watch: () => () => void;
  start: (jobs: Job[]) => void;
  cancel: (id: string) => void;
  remove: (id: string) => void;
  cancelSeason: (slug: string, seasonId: string, lang: string) => void;
};

const jobId = ({ details }: Job): string =>
  downloadId(details.slug, details.seasonId, details.ep, details.lang);

const without = <T>(record: Record<string, T>, ids: string[]): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([id]) => !ids.includes(id)));

// As many as the previous app resolved at once: enough to keep a large offer's slots fed.
const PREPARING_AT_ONCE = 3;

const take = createBudget();
let waiting: Job[] = [];
let workers = 0;

export const useDownloads = create<DownloadsState>((set, get) => {
  async function work(bridge: DownloadsBridge): Promise<void> {
    for (let job = waiting.shift(); job; job = waiting.shift()) {
      const id = jobId(job);
      if (!get().preparing[id]) continue;
      const outcome = await prepare(
        bridge.start,
        take,
        job.details,
        job.sources,
        () => !get().preparing[id],
      );
      // Cancelled while its start was already on the way: the entry exists now, drop it.
      if (outcome?.ok && !get().preparing[id]) void bridge.cancel(id);
      set((state) => ({
        preparing: without(state.preparing, [id]),
        failed:
          outcome && !outcome.ok
            ? { ...state.failed, [id]: outcome.error }
            : without(state.failed, [id]),
      }));
    }
  }

  // Every preparation draws on the same budget, so more workers never means more resolutions.
  function drain(): void {
    const bridge = getPlatform()?.downloads;
    if (!bridge) return;
    while (workers < PREPARING_AT_ONCE && waiting.length > 0) {
      workers++;
      void work(bridge).finally(() => {
        workers--;
      });
    }
  }

  return {
    items: {},
    preparing: {},
    failed: {},

    watch: () => {
      const bridge = getPlatform()?.downloads;
      if (!bridge) return () => undefined;
      const stop = bridge.onChange((id, item) => {
        set((state) => ({
          items: item ? { ...state.items, [id]: item } : without(state.items, [id]),
        }));
      });
      void bridge.list().then((list) => {
        set({ items: Object.fromEntries(list.map((item) => [item.id, item])) });
      });
      return stop;
    },

    start: (jobs) => {
      const fresh = jobs.filter((job) => !get().preparing[jobId(job)]);
      const ids = fresh.map(jobId);
      set((state) => ({
        preparing: { ...state.preparing, ...Object.fromEntries(ids.map((id) => [id, true])) },
        failed: without(state.failed, ids),
      }));
      waiting.push(...fresh);
      drain();
    },

    cancel: (id) => {
      if (get().preparing[id]) {
        set((state) => ({ preparing: without(state.preparing, [id]) }));
        return;
      }
      void getPlatform()?.downloads.cancel(id);
    },

    remove: (id) => {
      void getPlatform()?.downloads.remove(id);
    },

    cancelSeason: (slug, seasonId, lang) => {
      const prefix = seasonPrefix(slug, seasonId);
      const suffix = `::${lang}`;
      const ids = Object.keys(get().preparing).filter(
        (id) => id.startsWith(prefix) && id.endsWith(suffix),
      );
      waiting = waiting.filter((job) => !ids.includes(jobId(job)));
      set((state) => ({ preparing: without(state.preparing, ids) }));
      void getPlatform()?.downloads.cancelSeason(slug, seasonId, lang);
    },
  };
});
