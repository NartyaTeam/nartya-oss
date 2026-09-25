import type { OfflineCopy } from "../downloads/library.ts";
import type { PlayerSource } from "./Player.tsx";

export type OfflineParts = {
  localUrl: (id: string, file: string) => Promise<string | null>;
  position: () => Promise<number>;
  wait: (ms: number) => Promise<void>;
};

// Supabase first tries to refresh the token, which can take half a minute with no network.
const RESUME_WAIT_MS = 3_000;

export async function openOffline(
  copy: OfflineCopy | null,
  parts: OfflineParts,
): Promise<{ source: PlayerSource | null; startAt: number }> {
  const [url, startAt] = await Promise.all([
    copy ? parts.localUrl(copy.id, copy.file).catch(() => null) : null,
    Promise.race([parts.position(), parts.wait(RESUME_WAIT_MS).then(() => 0)]).catch(() => 0),
  ]);
  return {
    source: url && copy ? { url, isHls: copy.isHls, host: null, local: true } : null,
    startAt,
  };
}
