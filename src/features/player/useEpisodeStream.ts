import { useCallback, useEffect, useRef, useState } from "react";
import type { Source } from "../anime/types.ts";
import type { OfflineCopy } from "../downloads/library.ts";
import { openEpisode, type Playable } from "./resolve.ts";

export type Stream = {
  playable: Playable | null;
  host: string | null;
  local: boolean;
  loading: boolean;
  error: string | null;
  /** Where to pick up: the saved position, or where a source died mid episode. */
  startAt: number;
  onTime: (seconds: number) => void;
  onFailed: () => void;
  retry: () => void;
};

type StreamState = {
  key: string;
  playable: Playable | null;
  host: string | null;
  slot: string | null;
  loading: boolean;
  error: string | null;
  carried: number;
};

// Disqualified like a source when the file fails to play, which hands over to streaming.
const LOCAL_SLOT = "local";

const idle = (key: string, carried: number): StreamState => ({
  key,
  playable: null,
  host: null,
  slot: null,
  loading: true,
  error: null,
  carried,
});

// Resolution is keyed on the episode being watched: a new one starts its own attempt, and
// what a previous one had disqualified says nothing about this one.
export function useEpisodeStream(
  key: string,
  copy: OfflineCopy | null,
  sources: Source[],
  preferred: string,
  resumeAt: number,
): Stream {
  const [excluded, setExcluded] = useState<{ key: string; slots: string[] }>({ key, slots: [] });
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<StreamState>(() => idle(key, resumeAt));

  const slots = excluded.key === key ? excluded.slots : [];
  // The array is rebuilt on every render, so what identifies it is its contents.
  const disqualified = slots.join(",");
  // Carried across a source that dies mid episode, keyed so it is never carried across
  // episodes: an effect resetting it would run after the one that reads it.
  const position = useRef({ key, seconds: 0 });
  const failing = useRef(false);

  const latest = useRef({ copy, sources, preferred });
  latest.current = { copy, sources, preferred };

  useEffect(() => {
    let live = true;
    failing.current = false;
    const held = position.current;
    const carried = held.key === key && held.seconds > 1 ? held.seconds : 0;
    setState(idle(key, carried));

    const exclude = disqualified ? disqualified.split(",") : [];
    // Read when the episode opens: a download finishing mid watch does not swap the video.
    const { copy: downloaded, sources: offered, preferred: picked } = latest.current;
    void openEpisode(
      exclude.includes(LOCAL_SLOT) ? null : downloaded,
      offered,
      picked,
      exclude,
      attempt > 0,
    ).then((won) => {
      if (!live) return;
      setState({
        key,
        playable: won.ok ? won.value : null,
        host: won.ok ? (won.source?.key ?? null) : null,
        slot: won.ok ? (won.source?.slot ?? LOCAL_SLOT) : null,
        loading: false,
        error: won.ok ? null : won.error,
        carried,
      });
    });

    return () => {
      live = false;
    };
  }, [key, attempt, disqualified]);

  const onFailed = useCallback(() => {
    const slot = state.slot;
    // One dead source raises a flurry of events; the first is the one that counts.
    if (!slot || failing.current) return;
    failing.current = true;
    setExcluded((held) => ({
      key,
      slots: held.key === key ? [...held.slots, slot] : [slot],
    }));
  }, [key, state.slot]);

  return {
    playable: state.key === key ? state.playable : null,
    host: state.host,
    local: state.key === key && state.slot === LOCAL_SLOT,
    loading: state.key === key ? state.loading : true,
    error: state.key === key ? state.error : null,
    startAt: state.key === key && state.carried > 0 ? state.carried : resumeAt,
    onTime: (seconds) => {
      position.current = { key, seconds };
    },
    onFailed,
    retry: () => {
      setExcluded({ key, slots: [] });
      setAttempt((count) => count + 1);
    },
  };
}
