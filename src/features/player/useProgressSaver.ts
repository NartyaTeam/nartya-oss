import { useEffect, useRef } from "react";
import { SAVE_EVERY_MS, type Progress, type SaveWhat } from "./progress.ts";

// What is saved rides on the report, not on the render: at cleanup the render already
// describes the next episode, and the position just left would land under its key.
export function useProgressSaver(progress: Progress, userId: string, key: string) {
  const watching = useRef<SaveWhat | null>(null);
  const save = useRef<(force: boolean) => void>(() => undefined);
  save.current = (force) => {
    const what = watching.current;
    if (!what || what.duration <= 0) return;
    if (force) watching.current = null;
    void progress.save(userId, what, force);
  };

  useEffect(() => {
    const id = setInterval(() => save.current(false), SAVE_EVERY_MS);
    const onLeaving = (): void => save.current(true);
    window.addEventListener("pagehide", onLeaving);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", onLeaving);
      save.current(true);
    };
  }, [key]);

  return { watching, save: (force: boolean): void => save.current(force) };
}
