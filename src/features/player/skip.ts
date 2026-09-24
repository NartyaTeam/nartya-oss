import type { Skips } from "../anime/types.ts";

export type Credits = { kind: "intro" | "outro"; end: number; sceneAfter: boolean };

export const END_CARD_S = 10;
// Crowdsourced timestamps are a little late or early: a button that shows for the last
// half second would jump nowhere, and a gap of a second or two is not a scene.
const EDGE_S = 0.5;
const SCENE_AFTER_S = 3;

export function creditsAt(skips: Skips | null, time: number, duration: number): Credits | null {
  const { intro, outro } = skips ?? { intro: null, outro: null };
  if (intro && time >= intro.start && time < intro.end - EDGE_S) {
    return { kind: "intro", end: intro.end, sceneAfter: false };
  }
  if (outro && time >= outro.start && time < outro.end - EDGE_S) {
    return { kind: "outro", end: outro.end, sceneAfter: duration - outro.end > SCENE_AFTER_S };
  }
  return null;
}

// Whole seconds, so that the page only renders when the number on the card changes.
export function countdownAt(time: number, duration: number): number | null {
  if (!(duration > 0)) return null;
  const left = duration - time;
  return left > 0 && left <= END_CARD_S ? Math.ceil(left) : null;
}
