import type Artplayer from "artplayer";
import type { Store } from "./bandwidth.ts";
import { BOOSTS, boostLabel, saveBoost, savedBoost } from "./boost.ts";

const ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';

// The video element stops at the track's own level; a gain node after it goes further. Built
// only once a boost is asked for: all the sound then runs through a context that can stall.
export function addBoostMenu(art: Artplayer, store: Store): () => void {
  let context: AudioContext | null = null;
  let gain: GainNode | null = null;

  const wake = (): void => {
    if (context?.state === "suspended") void context.resume();
  };
  art.on("video:play", wake);

  const apply = (boost: number): void => {
    if (!gain && boost > 1) {
      context = new AudioContext();
      gain = context.createGain();
      // One source per element for its whole life, so the graph is built once and kept.
      context.createMediaElementSource(art.video).connect(gain);
      gain.connect(context.destination);
      wake();
    }
    if (gain && context) gain.gain.setTargetAtTime(boost, context.currentTime, 0.02);
  };

  const initial = savedBoost(store);
  apply(initial);
  art.setting.add({
    name: "boost",
    width: 160,
    html: "Boost audio",
    icon: ICON,
    tooltip: boostLabel(initial),
    selector: BOOSTS.map((boost) => ({ html: boostLabel(boost), default: boost === initial })),
    onSelect: (item) => {
      const boost = BOOSTS.find((candidate) => boostLabel(candidate) === item.html) ?? 1;
      saveBoost(store, boost);
      apply(boost);
      return item.html;
    },
  });

  return () => {
    void context?.close();
  };
}
