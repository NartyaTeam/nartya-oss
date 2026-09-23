import { choiceOf } from "../anime/season.ts";
import type { Source } from "../anime/types.ts";

export const AUTO = "auto";

// The first source gets a head start, then the next goes out in parallel rather than
// waiting for it: biased towards the preferred one, never blocked by a slow one.
export const STAGGER_MS = 1600;

export function orderSources(
  sources: Source[],
  preferred: string = AUTO,
  excluded: string[] = [],
): Source[] {
  const out = sources.filter((source) => !excluded.includes(source.slot));
  if (out.length === 0) return [];

  if (preferred !== AUTO) {
    const chosen = out.filter((source) => choiceOf(source) === preferred);
    if (chosen.length > 0) return chosen;
    // Picked by hand and every slot of it now disqualified: fall back to the automatic
    // order. Picked and simply unknown: there is nothing the viewer asked for to play.
    if (!sources.some((source) => choiceOf(source) === preferred)) return [];
  }
  return out;
}

export type Attempt<T> = { ok: true; value: T } | { ok: false; error: string };
export type Resolve<T> = (source: Source) => Promise<Attempt<T>>;

export type Won<T> = { ok: true; value: T; source: Source } | { ok: false; error: string };

export type HedgeParts = {
  staggerMs?: number;
  delay?: (ms: number) => { promise: Promise<void>; cancel: () => void };
};

function timer(ms: number): { promise: Promise<void>; cancel: () => void } {
  let done = (): void => undefined;
  const id = setTimeout(() => done(), ms);
  return {
    promise: new Promise<void>((resolve) => {
      done = resolve;
    }),
    cancel: () => clearTimeout(id),
  };
}

// The first source to produce something playable wins; the others keep going and fill the
// main process's cache, so switching to one by hand afterwards is instant.
export async function resolveHedged<T>(
  sources: Source[],
  resolve: Resolve<T>,
  parts: HedgeParts = {},
): Promise<Won<T>> {
  if (sources.length === 0) return { ok: false, error: "Aucune source pour cet épisode." };

  const staggerMs = parts.staggerMs ?? STAGGER_MS;
  const delay = parts.delay ?? timer;
  const errors: string[] = [];

  return new Promise<Won<T>>((settle) => {
    let done = false;
    let next = 0;
    let running = 0;
    let stagger: { cancel: () => void } | null = null;

    const finish = (answer: Won<T>): void => {
      if (done) return;
      done = true;
      stagger?.cancel();
      settle(answer);
    };

    const giveUp = (): void => {
      finish({
        ok: false,
        error: `Aucune source disponible. ${errors.slice(0, 2).join(", ")}`.trim(),
      });
    };

    const advance = (): void => {
      if (done || next >= sources.length) return;
      const source = sources[next++];
      if (!source) return;
      running += 1;

      stagger?.cancel();
      if (next < sources.length) {
        const armed = delay(staggerMs);
        stagger = armed;
        void armed.promise.then(() => {
          if (!done) advance();
        });
      }

      void resolve(source)
        .then((attempt) => {
          running -= 1;
          if (done) return;
          if (attempt.ok) {
            finish({ ok: true, value: attempt.value, source });
            return;
          }
          errors.push(`${source.label}: ${attempt.error}`);
          // A failure does not wait for the stagger: the next source goes out at once.
          if (next < sources.length) advance();
          else if (running === 0) giveUp();
        })
        .catch((error: unknown) => {
          running -= 1;
          if (done) return;
          errors.push(`${source.label}: ${error instanceof Error ? error.message : "erreur"}`);
          if (next < sources.length) advance();
          else if (running === 0) giveUp();
        });
    };

    advance();
  });
}
