import { useEffect, useRef, useState } from "react";
import type { ApiResult } from "./api.ts";
import type { ResourceStore } from "./resource-store.ts";

export type Resource<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  outdated: boolean;
  reload: () => void;
};

export type ResourceOptions = { persist?: boolean };

const inflight = new Map<string, Promise<unknown>>();

export type Forced = { key: string; count: number };

// A retry belongs to the key it was asked for. Counted for the component instead, one
// press would keep every later key from ever being served from cache again.
export function forcedFor(forced: Forced, key: string): number {
  return forced.key === key ? forced.count : 0;
}

// Stale while revalidate: what was read once is shown at once, then refreshed behind the
// screen. The displayed value is read from the store, so a new key never shows the old one.
export function useResource<T>(
  store: ResourceStore,
  key: string,
  load: () => Promise<ApiResult<T>>,
  options: ResourceOptions = {},
): Resource<T> {
  const [forced, setForced] = useState<Forced>({ key, count: 0 });
  const attempt = forcedFor(forced, key);
  const [, setTick] = useState(0);
  const [state, setState] = useState<{
    key: string;
    loading: boolean;
    error: string | null;
    outdated: boolean;
  }>({ key, loading: true, error: null, outdated: false });

  // The loader closes over props and is rebuilt on every render; the key is what identifies
  // the read, so it travels in a ref rather than restarting the effect each time.
  const latest = useRef({ load, persist: options.persist === true });
  latest.current = { load, persist: options.persist === true };

  const entry = store.get<T>(key);

  useEffect(() => {
    if (store.isFresh(store.get<T>(key)) && attempt === 0) {
      setState({ key, loading: false, error: null, outdated: false });
      return;
    }

    let live = true;
    setState({ key, loading: true, error: null, outdated: false });

    // Two screens asking for the same key at the same time is one call.
    const running =
      (inflight.get(key) as Promise<ApiResult<T>> | undefined) ?? latest.current.load();
    inflight.set(key, running);

    void running
      .then((answer) => {
        if (answer.ok) store.set(key, answer.data, latest.current.persist);
        if (!live) return;
        setTick((count) => count + 1);
        setState({
          key,
          loading: false,
          error: answer.ok ? null : answer.message,
          outdated: answer.ok ? false : answer.outdated,
        });
      })
      .finally(() => {
        if (inflight.get(key) === running) inflight.delete(key);
      });

    return () => {
      live = false;
    };
  }, [store, key, attempt]);

  // Between a key change and the effect, the state still describes the previous read.
  const settled = state.key === key;

  return {
    data: entry?.data ?? null,
    loading: settled ? state.loading : entry === null,
    error: settled ? state.error : null,
    outdated: settled ? state.outdated : false,
    reload: () => setForced({ key, count: attempt + 1 }),
  };
}
