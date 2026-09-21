export type ByteRange = { start: number; end: number };

export type Upstream = AsyncIterable<Buffer | Uint8Array> & { destroy?: () => void };
export type Slice = AsyncIterable<Buffer> & { destroy: () => void };

// Single ranges only: no video player emits multi range requests.
const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/;

export function parseByteRange(header: unknown, totalSize: number): ByteRange | null {
  const match = SINGLE_RANGE.exec(String(header ?? "").trim());
  if (!match || !Number.isFinite(totalSize) || totalSize <= 0) return null;

  const rawStart = match[1] ?? "";
  const rawEnd = match[2] ?? "";
  let start: number;
  let end: number;

  if (rawStart === "") {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? totalSize - 1 : Math.min(Number(rawEnd), totalSize - 1);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start > end || start >= totalSize) return null;
  return { start, end };
}

// Cuts a response down to [start, end] for a host that ignores Range and answers 200 with
// the whole body, which the player would otherwise take for a successful seek.
export function sliceUpstream(upstream: Upstream, start: number, end: number): Slice {
  return {
    destroy: () => {
      try {
        upstream.destroy?.();
      } catch {
        // The upstream is already gone, which is what we wanted.
      }
    },
    async *[Symbol.asyncIterator]() {
      let offset = 0;
      for await (const chunk of upstream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const chunkStart = offset;
        offset += buffer.length;
        if (offset <= start) continue;
        const from = Math.max(0, start - chunkStart);
        const to = Math.min(buffer.length, end - chunkStart + 1);
        if (to > from) yield buffer.subarray(from, to);
        // Everything after the range is wasted bandwidth, so stop pulling.
        if (offset > end) break;
      }
    },
  };
}
