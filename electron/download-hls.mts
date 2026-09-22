import { execFile } from "node:child_process";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { downloadToFile, runPool, type Fetch } from "./download-file.mts";
import { createLogger } from "./log.mts";
import {
  isMaster,
  KEY_FILE,
  MAP_FILE,
  pickVariant,
  planLocalPlaylist,
  PLAYLIST_FILE,
  readVariants,
} from "./hls-plan.mts";

export type HlsJob = {
  url: string;
  provider: string | null;
  dir: string;
  maxHeight: number;
  signal: AbortSignal;
  onProgress: (done: number, total: number, bytes: number) => void;
  onRemux?: () => void;
};

export type HlsResult = { file: string; sizeBytes: number };

const run = promisify(execFile);
const log = createLogger("download-hls");

// The limit on an hls download is latency per segment, hundreds of small gets. Eight
// hides it while staying under the provider agent's socket ceiling.
const SEGMENT_CONCURRENCY = 8;
const REMUX_TIMEOUT_MS = 10 * 60_000;
const KEEP_AFTER_REMUX = new Set(["video.mp4", "cover.jpg", "thumb.jpg"]);

async function readPlaylist(
  fetch: Fetch,
  url: string,
  provider: string | null,
  signal: AbortSignal,
) {
  const response = await fetch(url, { provider, signal });
  if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`);
  let text = "";
  for await (const chunk of response.stream) text += String(chunk);
  return { text, baseUrl: response.url || url };
}

// ffmpeg reads the local playlist and handles aes-128 and the fmp4 init itself. It takes
// the container from the file extension, hence -f mp4 when writing to video.mp4.part.
export async function remux(ffmpegPath: string, dir: string, signal: AbortSignal): Promise<number> {
  const out = join(dir, "video.mp4");
  const temporary = `${out}.part`;
  const args = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-allowed_extensions",
    "ALL",
    "-i",
    PLAYLIST_FILE,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    "-f",
    "mp4",
  ];
  const call = (extra: string[]) =>
    run(ffmpegPath, [...args, ...extra, "video.mp4.part"], {
      cwd: dir,
      timeout: REMUX_TIMEOUT_MS,
      maxBuffer: 8 * 1024 * 1024,
      signal,
    });

  try {
    // Most .ts streams carry aac in adts, which mp4 will not take as is. A stream that
    // does not need it fails on the flag, so it is retried without.
    await call(["-bsf:a", "aac_adtstoasc"]);
  } catch (error) {
    if (signal.aborted) throw error;
    await call([]);
  }

  await rename(temporary, out);
  return (await stat(out)).size;
}

async function dropSegments(dir: string): Promise<void> {
  const entries = await readdir(dir).catch(() => []);
  await Promise.all(
    entries
      .filter((name) => !KEEP_AFTER_REMUX.has(name))
      .map((name) => rm(join(dir, name), { force: true }).catch(() => {})),
  );
}

export async function downloadHls(
  fetch: Fetch,
  job: HlsJob,
  ffmpegPath: string | null,
): Promise<HlsResult> {
  await mkdir(job.dir, { recursive: true });

  let { text, baseUrl } = await readPlaylist(fetch, job.url, job.provider, job.signal);
  if (isMaster(text)) {
    const variant = pickVariant(readVariants(text, baseUrl), job.maxHeight);
    if (variant) {
      log.info("variant chosen", { height: variant.height, bandwidth: variant.bandwidth });
      ({ text, baseUrl } = await readPlaylist(fetch, variant.uri, job.provider, job.signal));
    }
  }

  const plan = planLocalPlaylist(text, baseUrl);
  if (plan.segments.length === 0) throw new Error("Playlist HLS sans segment");

  const get = (url: string, name: string) =>
    downloadToFile(fetch, url, join(job.dir, name), job.provider, job.signal);

  if (plan.keyUrl) await get(plan.keyUrl, KEY_FILE);
  if (plan.mapUrl) await get(plan.mapUrl, MAP_FILE);

  const total = plan.segments.length;
  const received = await runPool(
    total,
    SEGMENT_CONCURRENCY,
    job.signal,
    (index) => {
      const segment = plan.segments[index];
      if (!segment) return Promise.resolve(0);
      return get(segment.url, segment.name);
    },
    (done, bytes) => job.onProgress(done, total, bytes),
  );

  await writeFile(join(job.dir, PLAYLIST_FILE), plan.playlist);

  // Merging is a comfort, never a condition of success: hundreds of ten second files per
  // episode cannot be copied or shared like a normal one, but they do play.
  if (ffmpegPath) {
    job.onRemux?.();
    try {
      const sizeBytes = await remux(ffmpegPath, job.dir, job.signal);
      await dropSegments(job.dir);
      return { file: "video.mp4", sizeBytes };
    } catch (error) {
      if (job.signal.aborted) throw error;
      log.warn("remux failed, keeping the segments", { err: error });
    }
  }
  return { file: PLAYLIST_FILE, sizeBytes: received };
}
