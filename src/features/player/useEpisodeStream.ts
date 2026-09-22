import { useCallback, useEffect, useRef, useState } from "react";
import type { Source } from "../anime/types.ts";
import { resolveEpisode, type Playable } from "./resolve.ts";

export type Stream = {
  playable: Playable | null;
  host: string | null;
  loading: boolean;
  error: string | null;
  /** Where to pick up, carried across a source that died mid episode. */
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
  startAt: number;
};

const idle = (key: string, startAt: number): StreamState => ({
  key,
  playable: null,
  host: null,
  slot: null,
  loading: true,
  error: null,
  startAt,
});

// Resolution is keyed on the episode being watched: a new one starts its own attempt, and
// what a previous one had disqualified says nothing about this one.
export function useEpisodeStream(
  key: string,
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
  // A source dying mid episode must not restart it from the beginning.
  const position = useRef(0);
  const failing = useRef(false);

  const latest = useRef({ sources, preferred, resumeAt });
  latest.current = { sources, preferred, resumeAt };

  useEffect(() => {
    let live = true;
    failing.current = false;
    const carried = position.current > 1 ? position.current : latest.current.resumeAt;
    setState(idle(key, carried));

    const exclude = disqualified ? disqualified.split(",") : [];
    void resolveEpisode(latest.current.sources, latest.current.preferred, exclude).then((won) => {
      if (!live) return;
      setState({
        key,
        playable: won.ok ? won.value : null,
        host: won.ok ? won.source.key : null,
        slot: won.ok ? won.source.slot : null,
        loading: false,
        error: won.ok ? null : won.error,
        startAt: carried,
      });
    });

    return () => {
      live = false;
    };
  }, [key, attempt, disqualified]);

  // A new episode starts at its own position, not where the last one was left.
  useEffect(() => {
    position.current = 0;
  }, [key]);

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
    loading: state.key === key ? state.loading : true,
    error: state.key === key ? state.error : null,
    startAt: state.startAt,
    onTime: (seconds) => {
      position.current = seconds;
    },
    onFailed,
    retry: () => {
      setExcluded({ key, slots: [] });
      setAttempt((count) => count + 1);
    },
  };
}
