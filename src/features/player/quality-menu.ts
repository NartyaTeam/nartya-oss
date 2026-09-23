import type Artplayer from "artplayer";
import type Hls from "hls.js";
import type { Store } from "./bandwidth.ts";
import {
  levelForHeight,
  lockOptions,
  lockedLevel,
  qualityOptions,
  saveLock,
  saveQuality,
  savedLock,
  savedQuality,
  type Lock,
  type Quality,
} from "./quality.ts";

const ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 18v-3"/><path d="M12 18v-7"/><path d="M18 18V6"/></svg>';

// A fixed quality is a ceiling: adaptive bitrate keeps working below it.
export function capQuality(hls: Hls, quality: Quality): void {
  const cap = quality === "auto" ? -1 : levelForHeight(hls.levels, quality);
  // Left on, hls.js rewrites the cap from the player's size every second and the choice
  // looks ignored. On auto, that sizing is exactly what is wanted.
  hls.capLevelToPlayerSize = cap === -1;
  hls.autoLevelCapping = cap;
  hls.loadLevel = -1;
}

export function lockQuality(hls: Hls, lock: Lock): void {
  const level = lockedLevel(hls.levels, lock);
  hls.capLevelToPlayerSize = false;
  hls.autoLevelCapping = level;
  hls.loadLevel = level;
  // Switches at the next fragment instead of playing out a buffer of the lower variant.
  if (hls.currentLevel !== level) hls.nextLevel = level;
}

export function applyQuality(hls: Hls, store: Store, locked: boolean): void {
  if (locked) lockQuality(hls, savedLock(store));
  else capQuality(hls, savedQuality(store));
}

export function showQualityMenu(art: Artplayer, hls: Hls, store: Store, locked: boolean): void {
  const options = locked
    ? lockOptions(hls.levels, savedLock(store))
    : qualityOptions(hls.levels, savedQuality(store));
  if (options.length === 0) return;
  const byLabel = new Map(options.map((option) => [option.label, option.quality]));

  art.setting.update({
    name: "quality",
    width: 200,
    html: "Qualité",
    icon: ICON,
    tooltip: options.find((option) => option.selected)?.label ?? "",
    selector: options.map((option) => ({ html: option.label, default: option.selected })),
    // Artplayer shows whatever this returns as the setting's tooltip.
    onSelect: (item) => {
      const quality = byLabel.get(item.html);
      if (quality === undefined) return;
      if (locked && quality !== "auto") saveLock(store, quality);
      else saveQuality(store, quality);
      applyQuality(hls, store, locked);
      return item.html;
    },
  });
}
