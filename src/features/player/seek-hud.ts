export type SeekHud = { forward: boolean; seconds: number };

// Presses in a row add up, as on YouTube; turning back starts the count again.
export function addSeek(held: SeekHud | null, seconds: number): SeekHud {
  const forward = seconds > 0;
  const carried = held?.forward === forward ? held.seconds : 0;
  return { forward, seconds: carried + Math.abs(seconds) };
}
