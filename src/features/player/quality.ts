import type { Store } from "./bandwidth.ts";

export type Quality = "auto" | number;
export type QualityOption = { label: string; quality: Quality; selected: boolean };
type Level = { height: number; bitrate: number };

const KEY = "nartya:quality";
const AUTO_LABEL = "Auto";

// Two variants often share a height, and the capped one should be the better of the pair.
export function levelForHeight(levels: readonly Level[], height: number): number {
  let best = -1;
  let lowest = -1;
  levels.forEach((level, index) => {
    const current = levels[best];
    if (level.height <= height && (!current || outranks(level, current))) best = index;
    const bottom = levels[lowest];
    if (!bottom || level.height < bottom.height) lowest = index;
  });
  return best >= 0 ? best : lowest;
}

const outranks = (level: Level, other: Level): boolean =>
  level.height !== other.height ? level.height > other.height : level.bitrate > other.bitrate;

// A manifest without resolutions gives nothing a viewer could choose between.
export function qualityOptions(levels: readonly Level[], preference: Quality): QualityOption[] {
  const heights = [...new Set(levels.map((level) => level.height).filter((h) => h > 0))];
  if (heights.length < 2) return [];
  const capped = preference === "auto" ? -1 : levelForHeight(levels, preference);
  const selected = levels[capped]?.height ?? null;
  const fixed = heights
    .sort((a, b) => b - a)
    .map((height) => ({
      label: `${String(height)}p`,
      quality: height,
      selected: height === selected,
    }));
  return [{ label: AUTO_LABEL, quality: "auto", selected: selected === null }, ...fixed];
}

// Kept as a height, not a level index: the variants differ from one source to the next.
export function savedQuality(store: Store): Quality {
  try {
    const height = Number.parseInt(store.get(KEY) ?? "", 10);
    return Number.isInteger(height) && height > 0 ? height : "auto";
  } catch {
    // Storage the viewer blocked: every episode starts on auto, which is where it began.
    return "auto";
  }
}

export function saveQuality(store: Store, quality: Quality): void {
  try {
    store.set(KEY, String(quality));
  } catch {
    // Quota or a private window: the choice still holds for the episode being watched.
  }
}
