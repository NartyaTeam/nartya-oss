export type Store = {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
};

const GLOBAL_KEY = "nartya:bandwidth";
const BY_HOST_KEY = "nartya:bandwidth-by-host";

const FLOOR = 200_000;
const CEILING = 30_000_000;
const DEFAULT = 3_000_000;
// The measurement covers fragments already in flight on a warm connection, so it reads
// high; hls.js starts on what the link really sustained rather than on its best moment.
const MARGIN = 0.8;
// A host's own history moves, but one good fragment should not erase what came before.
const WEIGHT = 0.3;

const asNumber = (value: string | null): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

function readHosts(store: Store): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(store.get(BY_HOST_KEY) ?? "{}");
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

// Hosts run from about 2.8 to 28 Mb/s, so a global average starts the wrong ones badly.
export function estimateFor(store: Store, host: string | null): number {
  const clamp = (value: number): number => Math.min(Math.floor(value * MARGIN), CEILING);
  try {
    const known = host ? readHosts(store)[host] : undefined;
    if (known !== undefined && known > FLOOR) return clamp(known);
    const saved = asNumber(store.get(GLOBAL_KEY));
    if (saved > FLOOR) return clamp(saved);
  } catch {
    // Storage the viewer blocked: the default is a fine place to start.
  }
  return DEFAULT;
}

export function remember(store: Store, bitsPerSecond: number, host: string | null): void {
  if (!(bitsPerSecond > FLOOR)) return;
  try {
    store.set(GLOBAL_KEY, String(Math.floor(bitsPerSecond)));
    if (!host) return;
    const hosts = readHosts(store);
    const previous = hosts[host] ?? 0;
    hosts[host] = Math.floor(
      previous > FLOOR ? previous * (1 - WEIGHT) + bitsPerSecond * WEIGHT : bitsPerSecond,
    );
    store.set(BY_HOST_KEY, JSON.stringify(hosts));
  } catch {
    // Quota or a private window: the estimate is a convenience, never a requirement.
  }
}

export function browserStore(): Store {
  return {
    get: (key) => globalThis.localStorage.getItem(key),
    set: (key, value) => {
      globalThis.localStorage.setItem(key, value);
    },
  };
}
