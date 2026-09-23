import type { Store } from "./bandwidth.ts";

export type Anime4kMode = "a" | "b" | "c" | "aa" | "bb" | "ca";
export type Anime4kChoice = Anime4kMode | "off";

export const RECOMMENDED_MODE: Anime4kMode = "a";

export const MODES: { mode: Anime4kMode; name: string; use: string }[] = [
  { mode: "a", name: "Mode A", use: "Source floue" },
  { mode: "b", name: "Mode B", use: "Source avec halos" },
  { mode: "c", name: "Mode C", use: "Source propre" },
  { mode: "aa", name: "Mode A+A", use: "Source très floue" },
  { mode: "bb", name: "Mode B+B", use: "Halos marqués" },
  { mode: "ca", name: "Mode C+A", use: "Source propre, plus nette" },
];

const CHOICE_KEY = "nartya:anime4k";
const ACKNOWLEDGED_KEY = "nartya:anime4k-acknowledged";

export function choiceLabel(choice: Anime4kChoice): string {
  return MODES.find((entry) => entry.mode === choice)?.name ?? "Désactivé";
}

const isMode = (value: string | null): value is Anime4kMode =>
  MODES.some((entry) => entry.mode === value);

function read(store: Store, key: string): string | null {
  try {
    return store.get(key);
  } catch {
    // Storage the viewer blocked: Anime4K stays off, which is where it starts.
    return null;
  }
}

function write(store: Store, key: string, value: string): void {
  try {
    store.set(key, value);
  } catch {
    // Quota or a private window: the choice still holds for the episode being watched.
  }
}

// The warning is the viewer's consent to the GPU cost: without it, a saved mode stays off.
export function savedChoice(store: Store): Anime4kChoice {
  const saved = read(store, CHOICE_KEY);
  return isMode(saved) && isAcknowledged(store) ? saved : "off";
}

export function saveChoice(store: Store, choice: Anime4kChoice): void {
  write(store, CHOICE_KEY, choice);
}

export function isAcknowledged(store: Store): boolean {
  return read(store, ACKNOWLEDGED_KEY) === "yes";
}

export function acknowledge(store: Store): void {
  write(store, ACKNOWLEDGED_KEY, "yes");
}
