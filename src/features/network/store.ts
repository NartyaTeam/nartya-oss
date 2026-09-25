import { create } from "zustand";

export type Probe = () => Promise<boolean>;

type NetworkState = {
  online: boolean;
  // Offline is only ever shown once confirmed, so a slow start never sends anyone away.
  checked: boolean;
  watch: (probe: Probe, events?: EventTarget, wait?: (ms: number) => Promise<void>) => () => void;
};

// navigator.onLine reports false for a moment at a cold start on Windows while the network
// is fine, and one missed probe proves nothing: offline takes three in a row.
const RETRY_MS = [1_000, 2_000];
const RECHECK_MS = 30_000;

const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

export const useNetwork = create<NetworkState>((set, get) => ({
  online: true,
  checked: false,

  watch: (probe, events = window, wait = sleep) => {
    let live = true;
    let checking = false;

    async function check(): Promise<void> {
      if (checking) return;
      checking = true;
      try {
        for (const pause of [0, ...RETRY_MS]) {
          if (pause) await wait(pause);
          if (!live) return;
          if (await probe()) {
            if (live) set({ online: true, checked: true });
            return;
          }
        }
        if (live) set({ online: false, checked: true });
      } finally {
        checking = false;
      }
    }

    const wentOffline = (): void => set({ online: false, checked: true });
    const cameBack = (): void => void check();
    events.addEventListener("offline", wentOffline);
    events.addEventListener("online", cameBack);
    // The online event misses a network that is up with no internet behind it.
    const recheck = setInterval(() => {
      if (!get().online) void check();
    }, RECHECK_MS);
    void check();

    return () => {
      live = false;
      clearInterval(recheck);
      events.removeEventListener("offline", wentOffline);
      events.removeEventListener("online", cameBack);
    };
  },
}));
