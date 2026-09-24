import type { Store } from "./bandwidth.ts";

export const BOOSTS = [1, 1.5, 2, 2.5, 3];
const KEY = "nartya:audio-boost";

export const boostLabel = (boost: number): string => `${String(Math.round(boost * 100))} %`;

export function savedBoost(store: Store): number {
  try {
    const saved = Number(store.get(KEY));
    return BOOSTS.includes(saved) ? saved : 1;
  } catch {
    return 1;
  }
}

export function saveBoost(store: Store, boost: number): void {
  try {
    store.set(KEY, String(boost));
  } catch {
    // Storage blocked: the boost still holds until the player closes.
  }
}
