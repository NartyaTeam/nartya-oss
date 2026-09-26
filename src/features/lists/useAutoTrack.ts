import { useRef } from "react";
import { hasStarted, type Lists } from "./lists.ts";
import { useLists } from "./store.ts";

type Anime = { slug: string; title: string; cover: string | null };

export function useAutoTrack(api: Lists) {
  const tracked = useRef<string | null>(null);
  return (anime: Anime, seconds: number, duration: number): void => {
    if (tracked.current === anime.slug || !hasStarted(seconds, duration)) return;
    tracked.current = anime.slug;
    void useLists.getState().track(api, anime);
  };
}
