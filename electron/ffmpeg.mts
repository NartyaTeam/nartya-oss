import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createLogger } from "./log.mts";

const run = promisify(execFile);
const log = createLogger("ffmpeg");
const PROBE_TIMEOUT_MS = 5_000;

// Nothing is bundled: merging hls segments into one file is a comfort, and shipping a
// 70 MB binary for it is not worth the installer. Without ffmpeg the segments are kept.
export function createFfmpegLookup(probe: (path: string) => Promise<void>) {
  let found: string | null | undefined;

  return async function lookUp(): Promise<string | null> {
    if (found !== undefined) return found;

    const candidates = [process.env.NARTYA_FFMPEG, "ffmpeg"].filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    );
    for (const candidate of candidates) {
      try {
        await probe(candidate);
        log.info("found", { path: candidate });
        found = candidate;
        return found;
      } catch {
        // Try the next one, then give up quietly.
      }
    }

    log.info("not found, downloads keep their segments");
    found = null;
    return null;
  };
}

async function probeFfmpeg(path: string): Promise<void> {
  await run(path, ["-version"], { timeout: PROBE_TIMEOUT_MS });
}

export const findFfmpeg = createFfmpegLookup(probeFfmpeg);
