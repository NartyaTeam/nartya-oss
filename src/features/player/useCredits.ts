import { useState } from "react";
import type { Skips } from "../anime/types.ts";
import { countdownAt, creditsAt, type Credits } from "./skip.ts";

type CreditsState = {
  key: string;
  credits: Credits | null;
  countdown: number | null;
  dismissed: boolean;
};

const fresh = (key: string): CreditsState => ({
  key,
  credits: null,
  countdown: null,
  dismissed: false,
});

const sameCredits = (a: Credits | null, b: Credits | null): boolean =>
  a?.kind === b?.kind && a?.end === b?.end && a?.sceneAfter === b?.sceneAfter;

// Fed by the player's clock, but only renders when what is on screen has to change.
export function useCredits(key: string, skips: Skips | null) {
  const [state, setState] = useState(() => fresh(key));
  const current = state.key === key ? state : fresh(key);

  const report = (time: number, duration: number): void => {
    const credits = creditsAt(skips, time, duration);
    const countdown = countdownAt(time, duration);
    setState((held) => {
      const base = held.key === key ? held : fresh(key);
      if (base !== held || !sameCredits(base.credits, credits) || base.countdown !== countdown) {
        return { ...base, credits, countdown };
      }
      return held;
    });
  };

  const dismiss = (): void => {
    setState((held) => ({ ...(held.key === key ? held : fresh(key)), dismissed: true }));
  };

  return { ...current, report, dismiss };
}
