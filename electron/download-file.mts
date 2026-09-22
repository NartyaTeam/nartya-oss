import { createWriteStream } from "node:fs";
import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import type { Readable } from "node:stream";
import type { ProviderResponse } from "./provider-fetch.mts";

export type Fetch = (
  url: string,
  options: { provider?: string | null; rangeHeader?: string; signal: AbortSignal },
) => Promise<ProviderResponse>;

export const STALL_MS = 20_000;
export const MAX_ATTEMPTS = 3;

// A host that accepts the connection and then sends nothing would otherwise hold the
// download open for ever, the "stuck at 99%" symptom.
export function stallGuard(stream: Readable, ms: number = STALL_MS) {
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

export function aborted(): Error {
  return new DOMException("Aborted", "AbortError");
}

// One flaky segment out of hundreds must not fail a whole episode.
export async function retrying<T>(
  signal: AbortSignal,
  attempt: (n: number) => Promise<T>,
): Promise<T> {
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

export function drain(
  stream: Readable,
  out: NodeJS.WritableStream,
  onChunk?: (size: number) => void,
): Promise<void> {
  return new Promise((done, failed) => {
    const guard = stallGuard(stream);
    guard.arm();
    stream.on("data", (chunk: Buffer) => {
      guard.arm();
      onChunk?.(chunk.length);
    });
    stream.on("error", (error) => {
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
    stream.pipe(out);
  });
}

// Written to .part then renamed, so a half file never passes for a complete one.
export async function downloadToFile(
  fetch: Fetch,
  url: string,
  dest: string,
  provider: string | null,
  signal: AbortSignal,
): Promise<number> {
  await mkdir(dirname(dest), { recursive: true });
  const temporary = `${dest}.part`;

  const bytes = await retrying(signal, async () => {
    const response = await fetch(url, { provider, signal });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }
    let received = 0;
    await drain(response.stream, createWriteStream(temporary), (size) => (received += size));
    return received;
  });

  await rename(temporary, dest);
  return bytes;
}
