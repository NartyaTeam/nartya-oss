const TIMEOUT_MS = 15_000;
const MAX_DEPTH = 3;
const RANGE_BYTES = 65_535;

const say = (depth: number, line: string) => console.log(`${"  ".repeat(depth + 1)}${line}`);

function reason(error: unknown): string {
  const cause = (error as { cause?: { code?: string } }).cause;
  return cause?.code ?? (error as Error).message;
}

// A receiver reads the playlist, picks a variant and pulls the first segment; a plain file
// is never read whole, it is opened and then asked for a range further in.
export async function fetchLikeATv(url: string, depth = 0): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const type = response.headers.get("content-type") ?? "";
    const cors = response.headers.get("access-control-allow-origin") ?? "absent";
    const size = Number(response.headers.get("content-length")) || 0;
    const body = await response.text();
    const isPlaylist = type.includes("mpegurl") || body.startsWith("#EXTM3U");

    if (!isPlaylist) {
      const shown = size ? `${(size / 1e6).toFixed(1)} Mo` : "taille ?";
      say(depth, `GET ${response.status} ${type || "?"} ${shown}, CORS=${cors}`);
      if (!response.ok) return false;
      return depth === 0 ? checkRange(url, size, depth) : true;
    }

    say(depth, `GET ${response.status} ${type || "?"} ${body.length} octets, CORS=${cors}`);
    if (!response.ok) return false;
    if (depth >= MAX_DEPTH) return true;

    const next = body
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#"));
    return next ? fetchLikeATv(new URL(next, url).toString(), depth + 1) : true;
  } catch (error) {
    say(depth, `ECHEC ${reason(error)}`);
    return false;
  }
}

// Without a 206 the television could not move through the video at all.
async function checkRange(url: string, size: number, depth: number): Promise<boolean> {
  const from = size ? Math.floor(size / 2) : 1_000_000;
  try {
    const response = await fetch(url, {
      headers: { Range: `bytes=${from}-${from + RANGE_BYTES}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    void response.body?.cancel();
    const range = response.headers.get("content-range") ?? "";
    const seekable = response.status === 206 ? "" : " (seek impossible)";
    say(depth, `Range ${from} -> ${response.status} ${range}${seekable}`);
    return response.ok;
  } catch (error) {
    say(depth, `Range ECHEC ${reason(error)}`);
    return false;
  }
}
