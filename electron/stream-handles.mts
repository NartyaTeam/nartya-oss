import crypto from "node:crypto";

export type Target = {
  url: string;
  provider: string | null;
  referer: string;
  origin: string;
};

// An hls playlist mints one handle per segment, around 250 for a 24 minute episode per
// variant. This covers several episodes in a row before the oldest are evicted.
const MAX_HANDLES = 20_000;

function contentKey(target: Target): string {
  return `${target.url}|${target.provider ?? ""}|${target.referer}|${target.origin}`;
}

// The player only ever sees ?h=<handle>: the host url stays in the main process. Not a
// secret, since the tls connection still shows the domain, but it is no longer displayed.
export function createHandles(max = MAX_HANDLES) {
  const byHandle = new Map<string, Target>();
  const byContent = new Map<string, string>();

  function mint(target: Partial<Target> & { url?: string }): string | null {
    if (!target.url) return null;
    const entry: Target = {
      url: target.url,
      provider: target.provider ?? null,
      referer: target.referer ?? "",
      origin: target.origin ?? "",
    };

    const key = contentKey(entry);
    const existing = byContent.get(key);
    if (existing !== undefined && byHandle.has(existing)) return existing;

    const handle = crypto.randomBytes(9).toString("base64url");
    byHandle.set(handle, entry);
    byContent.set(key, handle);

    while (byHandle.size > max) {
      const oldest = byHandle.keys().next().value;
      if (oldest === undefined) break;
      const victim = byHandle.get(oldest);
      byHandle.delete(oldest);
      if (victim && byContent.get(contentKey(victim)) === oldest) {
        byContent.delete(contentKey(victim));
      }
    }
    return handle;
  }

  function resolve(handle: string | null): Target | null {
    if (!handle) return null;
    return byHandle.get(handle) ?? null;
  }

  function clear(): void {
    byHandle.clear();
    byContent.clear();
  }

  return {
    mint,
    resolve,
    clear,
    get size() {
      return byHandle.size;
    },
  };
}

export type Handles = ReturnType<typeof createHandles>;

export const streamHandles = createHandles();
