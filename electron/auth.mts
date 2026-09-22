import { createAuthCallbackServer } from "./auth-callback.mts";
import { createLogger } from "./log.mts";

export type CallbackServer = {
  start: (callback: (url: string) => void) => Promise<number | null>;
  redirectUrl: () => string | null;
  stop: () => void;
};

export type OpenUrl = (url: string) => Promise<void>;

export type AuthParts = {
  openUrl: OpenUrl;
  server?: CallbackServer;
  waitMs?: number;
};

const log = createLogger("auth");

// Long enough to read a consent screen or go and fetch an email, short enough that a
// forgotten window does not leave a port open on the machine for the whole session.
const WAIT_MS = 5 * 60_000;

export function createAuth(parts: AuthParts) {
  const { openUrl } = parts;
  const server = parts.server ?? createAuthCallbackServer();
  const waitMs = parts.waitMs ?? WAIT_MS;

  let pending: ((url: string | null) => void) | null = null;
  let timer: NodeJS.Timeout | null = null;

  function settle(url: string | null): void {
    const waiting = pending;
    pending = null;
    if (timer) clearTimeout(timer);
    timer = null;
    waiting?.(url);
  }

  function done(url: string | null): void {
    settle(url);
    // The callback page is written after this returns, so the port closes a tick later.
    setImmediate(() => server.stop());
  }

  async function redirectUrl(): Promise<string | null> {
    const current = server.redirectUrl();
    if (current) return current;

    await server.start(done);
    const started = server.redirectUrl();
    if (!started) log.warn("no loopback port available for the auth callback");
    return started;
  }

  function awaitCallback(): Promise<string | null> {
    // A second wait replaces the first: only one sign in is ever in flight, and it is the
    // one the person is looking at. The port stays open for it.
    settle(null);
    return new Promise((resolve) => {
      pending = resolve;
      timer = setTimeout(() => {
        log.info("auth callback timed out");
        done(null);
      }, waitMs);
    });
  }

  // Only https, so a renderer that got compromised cannot make the system open a file or a
  // scheme handler. It is the same power as clicking a link, no more.
  async function open(url: unknown): Promise<boolean> {
    if (typeof url !== "string" || !url.startsWith("https://")) {
      log.warn("refused to open an external url", { url: typeof url === "string" ? url : "?" });
      return false;
    }
    try {
      await openUrl(url);
      return true;
    } catch (error) {
      log.warn("the system refused to open the browser", { err: error });
      return false;
    }
  }

  return { redirectUrl, awaitCallback, open, cancel: () => done(null) };
}

export type Auth = ReturnType<typeof createAuth>;
