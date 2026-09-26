import { useEffect, useRef } from "react";
import { beatDue, episodeKey, type Progress, type SaveWhat } from "./progress.ts";

// What is saved rides on the report, not on the render: at cleanup the render already
// describes the next episode, and the position just left would land under its key.
export function useProgressSaver(
  progress: Progress,
  userId: string,
  key: string,
  seasonTotal: number | null,
) {
  const watching = useRef<SaveWhat | null>(null);
  const lastBeat = useRef<{ key: string; at: number } | null>(null);
  const save = useRef<(force: boolean) => void>(() => undefined);
  save.current = (force) => {
    const what = watching.current;
    if (!what || what.duration <= 0) return;
    if (force) watching.current = null;
    void progress.save(userId, what, force);
  };

  // Reports only come while the video plays, so a pause is never credited as watching.
  const report = (what: SaveWhat): void => {
    watching.current = what;
    const now = Date.now();
    const since = lastBeat.current?.key === key ? lastBeat.current.at : null;
    const due = beatDue(what, since, now);
    if (!due) return;
    lastBeat.current = { key, at: now };
    if (due === "tick") void progress.tick(what, seasonTotal);
    else {
      void progress.beat(episodeKey(what.slug, what.seasonId, what.episodeNumber, what.language));
    }
  };

  useEffect(() => {
    const onLeaving = (): void => save.current(true);
    window.addEventListener("pagehide", onLeaving);
    return () => {
      window.removeEventListener("pagehide", onLeaving);
      save.current(true);
    };
  }, [key]);

  return { watching, report, save: (force: boolean): void => save.current(force) };
}
