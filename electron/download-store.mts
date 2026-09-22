import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DownloadItem } from "../shared/downloads.ts";

export type Items = Record<string, DownloadItem>;

const SAVE_DELAY_MS = 2_000;

function readItems(file: string): Items {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

  const items: Items = {};
  for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const record = value as Record<string, unknown>;
    // Records written before downloads had a type are all episodes.
    items[id] = { type: "episode", ...record, id } as DownloadItem;
  }
  return items;
}

// Written whole, through a temporary file: a crash mid write would otherwise leave an
// index that parses as nothing and takes the whole offline library with it.
function writeItems(file: string, items: Items): void {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(items, null, 2)}\n`);
  renameSync(temporary, file);
}

// Kept in memory and flushed on a delay: progress ticks land several times a second, and
// rewriting the index on each one blocked the main process, and with it playback.
export function createItemStore(file: string, saveDelayMs: number = SAVE_DELAY_MS) {
  let items = readItems(file);
  let timer: NodeJS.Timeout | null = null;

  function flush(): void {
    if (timer) clearTimeout(timer);
    timer = null;
    writeItems(file, items);
  }

  function saveSoon(): void {
    if (timer) return;
    timer = setTimeout(flush, saveDelayMs);
    timer.unref();
  }

  return {
    all: (): Items => items,
    get: (id: string): DownloadItem | null => items[id] ?? null,

    set(id: string, patch: Partial<DownloadItem>, { now = false } = {}): DownloadItem {
      const next = { ...(items[id] ?? {}), ...patch, id } as DownloadItem;
      items[id] = next;
      if (now) flush();
      else saveSoon();
      return next;
    },

    remove(id: string): void {
      delete items[id];
      flush();
    },

    clear(): void {
      items = {};
      flush();
    },

    flush,
  };
}

export type ItemStore = ReturnType<typeof createItemStore>;
