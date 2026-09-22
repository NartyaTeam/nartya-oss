export type Entry<T> = { data: T; at: number; stale?: boolean };

export type Kept = {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
};

export type StoreParts = {
  now?: () => number;
  kept?: Kept | null;
  freshMs?: number;
  keepMs?: number;
};

const PREFIX = "nartya:resource:";
const FRESH_MS = 10 * 60_000;
const KEEP_MS = 7 * 24 * 60 * 60_000;

export function browserStorage(): Kept | null {
  try {
    // A private window, or storage the user blocked, throws on the first touch.
    globalThis.localStorage.getItem(PREFIX);
    return {
      get: (key) => globalThis.localStorage.getItem(PREFIX + key),
      set: (key, value) => globalThis.localStorage.setItem(PREFIX + key, value),
    };
  } catch {
    return null;
  }
}

export function createResourceStore(parts: StoreParts = {}) {
  const now = parts.now ?? Date.now;
  const kept = parts.kept === undefined ? browserStorage() : parts.kept;
  const freshMs = parts.freshMs ?? FRESH_MS;
  const keepMs = parts.keepMs ?? KEEP_MS;

  const memory = new Map<string, Entry<unknown>>();

  function fromDisk<T>(key: string): Entry<T> | null {
    const raw = kept?.get(key);
    if (!raw) return null;
    try {
      const saved = JSON.parse(raw) as { data?: T; at?: number };
      if (saved.data === undefined || typeof saved.at !== "number") return null;
      if (now() - saved.at > keepMs) return null;
      // Served at once, but marked stale rather than dated zero: a value from a previous
      // launch fills the screen, it never stands in for a fresh read.
      return { data: saved.data, at: saved.at, stale: true };
    } catch {
      return null;
    }
  }

  return {
    get<T>(key: string): Entry<T> | null {
      const held = memory.get(key) as Entry<T> | undefined;
      if (held) return held;

      const saved = fromDisk<T>(key);
      if (saved) memory.set(key, saved);
      return saved;
    },

    set<T>(key: string, data: T, persist = false): void {
      const entry = { data, at: now() };
      memory.set(key, entry);
      if (!persist || !kept) return;
      try {
        kept.set(key, JSON.stringify(entry));
      } catch {
        // Quota full: the memory cache keeps working, which is what the screen reads.
      }
    },

    isFresh(entry: Entry<unknown> | null): boolean {
      if (entry === null || entry.stale === true) return false;
      return now() - entry.at < freshMs;
    },
  };
}

export type ResourceStore = ReturnType<typeof createResourceStore>;
