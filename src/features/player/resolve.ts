import { getPlatform } from "../../lib/platform.ts";
import type { Source } from "../anime/types.ts";
import { orderSources, resolveHedged, type Won } from "./sources.ts";

export type Playable = { url: string; isHls: boolean };

const NO_BRIDGE = "La lecture n'est disponible que dans l'application Nartya.";

// A guard for the renderer only: the main process has its own deadlines on the api and on
// the host, and this one only covers an ipc call that never answers at all.
const IPC_TIMEOUT_MS = 20_000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("Source trop lente")), ms);
    work.then(resolve, reject).finally(() => clearTimeout(id));
  });
}

// A retry that reuses the main process's five minute cache hands back the very handle
// that just failed, instantly and identically.
export function resolveEpisode(
  sources: Source[],
  preferred: string,
  excluded: string[] = [],
  forceRefresh = false,
): Promise<Won<Playable>> {
  const bridge = getPlatform()?.stream;
  if (!bridge) return Promise.resolve({ ok: false, error: NO_BRIDGE });

  const ordered = orderSources(sources, preferred, excluded);
  return resolveHedged(ordered, async (source) => {
    const outcome = await withTimeout(bridge.resolve(source.id, forceRefresh), IPC_TIMEOUT_MS);
    return outcome.ok
      ? { ok: true as const, value: { url: outcome.url, isHls: outcome.isHls } }
      : { ok: false as const, error: outcome.error };
  });
}
