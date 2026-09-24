// The api allows 60 stream resolutions a minute per account, and playback draws on the
// same count: downloads keep to 40 so that a season never makes the episode on screen fail.
export const RESOLVES_PER_MINUTE = 40;
const WINDOW_MS = 60_000;

// Milliseconds to wait before the next resolution fits, zero when it fits now.
export function waitFor(stamps: number[], now: number): number {
  const recent = stamps.filter((stamp) => now - stamp < WINDOW_MS);
  if (recent.length < RESOLVES_PER_MINUTE) return 0;
  const oldest = Math.min(...recent);
  return WINDOW_MS - (now - oldest);
}

export function createBudget(now: () => number = Date.now) {
  let stamps: number[] = [];

  // Waits in short steps so that a cancelled season does not sit out a whole minute.
  return async function take(stopped: () => boolean): Promise<boolean> {
    for (;;) {
      if (stopped()) return false;
      const at = now();
      stamps = stamps.filter((stamp) => at - stamp < WINDOW_MS);
      const wait = waitFor(stamps, at);
      if (wait === 0) {
        stamps.push(at);
        return true;
      }
      await new Promise((done) => setTimeout(done, Math.min(wait, 1000)));
    }
  };
}
