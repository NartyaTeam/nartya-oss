import { createWriteStream } from "node:fs";
import { mkdir, open, rename } from "node:fs/promises";
import { dirname } from "node:path";
import type { Readable } from "node:stream";
import type { ProviderResponse } from "./provider-fetch.mts";

export type Fetch = (
  url: string,
  options: { provider?: string | null; rangeHeader?: string; signal: AbortSignal },
) => Promise<ProviderResponse>;

export type Progress = (received: number, total: number) => void;

export type Job = {
  url: string;
  provider: string | null;
  dest: string;
  signal: AbortSignal;
  onProgress: Progress;
};

export type Range = { start: number; end: number };

// Free hosts throttle each connection rather than each address, so one stream inherits a
// ceiling of a few Mbps whatever the line can do. Pulling ranges in parallel lifts it.
const CONNECTIONS = 4;
const MIN_PARALLEL_BYTES = 8 * 1024 * 1024;
const STALL_MS = 20_000;
const MAX_ATTEMPTS = 3;
const EMIT_EVERY_MS = 400;

// A host that accepts the connection and then sends nothing would otherwise hold the
// download open for ever, the "stuck at 99%" symptom.
export function stallGuard(stream: Readable, ms: number) {
  let timer: NodeJS.Timeout | null = null;
  return {
    arm() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => stream.destroy(new Error("Segment bloqué (stall)")), ms);
    },
    clear() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

export function totalFromContentRange(header: string | undefined): number {
  const match = /\/(\d+)\s*$/.exec(header ?? "");
  return match?.[1] ? Number(match[1]) : 0;
}

export function planRanges(
  total: number,
  connections = CONNECTIONS,
  min = MIN_PARALLEL_BYTES,
): Range[] {
  const parts = Math.max(1, Math.min(connections, Math.ceil(total / min)));
  const size = Math.ceil(total / parts);
  const ranges: Range[] = [];
  for (let index = 0; index < parts; index++) {
    const start = index * size;
    if (start >= total) break;
    ranges.push({ start, end: Math.min(start + size - 1, total - 1) });
  }
  return ranges;
}

function aborted(): Error {
  return new DOMException("Aborted", "AbortError");
}

async function retrying<T>(signal: AbortSignal, attempt: (n: number) => Promise<T>): Promise<T> {
  let last: unknown;
  for (let n = 1; n <= MAX_ATTEMPTS; n++) {
    if (signal.aborted) throw aborted();
    try {
      return await attempt(n);
    } catch (error) {
      if (signal.aborted) throw error;
      last = error;
      if (n < MAX_ATTEMPTS) await new Promise((wait) => setTimeout(wait, 500 * n));
    }
  }
  throw last;
}

async function singleOnce(fetch: Fetch, job: Job, temporary: string): Promise<number> {
  const response = await fetch(job.url, { provider: job.provider, signal: job.signal });
  if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`);

  const total = Number(response.headers["content-length"] ?? 0) || 0;
  let received = 0;
  let lastEmit = 0;

  await new Promise<void>((done, failed) => {
    const out = createWriteStream(temporary);
    const guard = stallGuard(response.stream, STALL_MS);
    guard.arm();

    response.stream.on("data", (chunk: Buffer) => {
      guard.arm();
      received += chunk.length;
      const now = Date.now();
      if (now - lastEmit > EMIT_EVERY_MS) {
        lastEmit = now;
        job.onProgress(received, total);
      }
    });
    response.stream.on("error", (error) => {
      guard.clear();
      failed(error);
    });
    out.on("error", (error) => {
      guard.clear();
      failed(error);
    });
    out.on("finish", () => {
      guard.clear();
      done();
    });
    response.stream.pipe(out);
  });

  return received || total;
}

export async function downloadSingle(fetch: Fetch, job: Job): Promise<number> {
  await mkdir(dirname(job.dest), { recursive: true });
  const temporary = `${job.dest}.part`;
  const size = await retrying(job.signal, () => singleOnce(fetch, job, temporary));
  await rename(temporary, job.dest);
  return size;
}

export async function downloadParallel(fetch: Fetch, job: Job, total: number): Promise<number> {
  await mkdir(dirname(job.dest), { recursive: true });
  const temporary = `${job.dest}.part`;

  const preallocate = await open(temporary, "w");
  try {
    await preallocate.truncate(total);
  } finally {
    await preallocate.close();
  }

  const ranges = planRanges(total);
  // Counted per range and reset on a retry: a retry starting from zero would otherwise
  // add its bytes on top of the previous attempt and push the percentage past 100.
  const progress = new Array<number>(ranges.length).fill(0);
  const received = () => progress.reduce((sum, part) => sum + part, 0);
  let lastEmit = 0;
  // Once a range has given up, the others stop reporting: otherwise they kept writing
  // "downloading" over the error and the entry stayed stuck in progress for ever.
  let stopped = false;

  async function rangeOnce(index: number, range: Range): Promise<void> {
    progress[index] = 0;
    const response = await fetch(job.url, {
      provider: job.provider,
      rangeHeader: `bytes=${range.start}-${range.end}`,
      signal: job.signal,
    });
    if (response.status !== 206) throw new Error(`Range non honoré (HTTP ${response.status})`);

    const file = await open(temporary, "r+");
    let position = range.start;
    try {
      const guard = stallGuard(response.stream, STALL_MS);
      guard.arm();
      await new Promise<void>((done, failed) => {
        response.stream.on("data", (chunk: Buffer) => {
          guard.arm();
          if (stopped) {
            response.stream.destroy(aborted());
            return;
          }
          // Paused while writing, which also keeps the writes inside a range in order.
          response.stream.pause();
          file
            .write(chunk, 0, chunk.length, position)
            .then(({ bytesWritten }) => {
              position += bytesWritten;
              progress[index] = (progress[index] ?? 0) + bytesWritten;
              const now = Date.now();
              if (!stopped && now - lastEmit > EMIT_EVERY_MS) {
                lastEmit = now;
                job.onProgress(received(), total);
              }
              response.stream.resume();
            })
            .catch(failed);
        });
        response.stream.on("error", (error) => {
          guard.clear();
          failed(error);
        });
        response.stream.on("end", () => {
          guard.clear();
          done();
        });
      });
    } finally {
      await file.close();
    }
  }

  await Promise.all(
    ranges.map(async (range, index) => {
      try {
        await retrying(job.signal, () => rangeOnce(index, range));
      } catch (error) {
        stopped = true;
        throw error;
      }
    }),
  );

  await rename(temporary, job.dest);
  return total;
}

export async function downloadMp4(fetch: Fetch, job: Job): Promise<number> {
  let total = 0;

  try {
    const probe = await fetch(job.url, {
      provider: job.provider,
      rangeHeader: "bytes=0-1",
      signal: job.signal,
    });
    if (probe.status === 206) total = totalFromContentRange(probe.headers["content-range"]);
    probe.stream.destroy();
  } catch (error) {
    if (job.signal.aborted) throw error;
  }

  if (total > MIN_PARALLEL_BYTES) {
    try {
      return await downloadParallel(fetch, job, total);
    } catch (error) {
      if (job.signal.aborted) throw error;
    }
  }
  return downloadSingle(fetch, job);
}
