import { createAuthCallbackServer, type Handlers } from "./auth-callback.mts";
import { isSiteKey } from "./captcha.mts";
import { createLogger } from "./log.mts";

export type CallbackServer = {
  start: (handlers: Handlers) => Promise<number | null>;
  redirectUrl: () => string | null;
  captchaUrl: (siteKey: string) => string | null;
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

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

function isOpenable(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" || (protocol === "http:" && LOOPBACK.has(hostname));
  } catch {
    return false;
  }
}

export function createAuth(parts: AuthParts) {
  const { openUrl } = parts;
  const server = parts.server ?? createAuthCallbackServer();
  const waitMs = parts.waitMs ?? WAIT_MS;

  let pending: ((url: string | null) => void) | null = null;
  let timer: NodeJS.Timeout | null = null;
  let waitingCaptcha: ((token: string | null) => void) | null = null;
  let captchaTimer: NodeJS.Timeout | null = null;
  let arrived: string | null = null;

  function settle(url: string | null): void {
    const waiting = pending;
    pending = null;
    if (timer) clearTimeout(timer);
    timer = null;
    waiting?.(url);
  }

  function settleCaptcha(token: string | null): void {
    const waiting = waitingCaptcha;
    waitingCaptcha = null;
    if (captchaTimer) clearTimeout(captchaTimer);
    captchaTimer = null;
    waiting?.(token);
  }

  // The page the browser is on is written after the handler returns, so the port closes a
  // tick later, and only once nothing else is waiting on it.
  function closeWhenIdle(): void {
    setImmediate(() => {
      if (!pending && !waitingCaptcha) server.stop();
    });
  }

  function done(url: string | null): void {
    // The browser can come back before the renderer starts waiting, and a callback that
    // lands on nobody would otherwise leave the sign in hanging until it times out.
    if (url !== null) log.info("callback received", { url });
    if (url !== null && !pending) arrived = url;
    else settle(url);
    closeWhenIdle();
  }

  function captchaDone(token: string | null): void {
    settleCaptcha(token);
    closeWhenIdle();
  }

  async function listening(): Promise<boolean> {
    if (server.redirectUrl()) return true;
    await server.start({ onCallback: done, onCaptcha: captchaDone });
    if (server.redirectUrl()) return true;
    log.warn("no loopback port available");
    return false;
  }

  async function redirectUrl(): Promise<string | null> {
    // Asking for one starts an attempt, so an answer to the previous one is not its answer.
    arrived = null;
    return (await listening()) ? server.redirectUrl() : null;
  }

  // The captcha page is ours and lives on this loopback port, so it is opened directly:
  // the https rule guards what the renderer asks for, not what we built.
  async function captchaToken(siteKey: unknown): Promise<string | null> {
    if (!isSiteKey(siteKey)) {
      log.warn("no usable captcha site key");
      return null;
    }
    if (!(await listening())) return null;

    const url = server.captchaUrl(siteKey);
    if (!url) return null;

    settleCaptcha(null);
    const solved = new Promise<string | null>((resolve) => {
      waitingCaptcha = resolve;
      captchaTimer = setTimeout(() => {
        log.info("captcha timed out");
        captchaDone(null);
      }, waitMs);
    });

    try {
      await openUrl(url);
    } catch (error) {
      log.warn("the system refused to open the captcha page", { err: error });
      captchaDone(null);
    }
    return solved;
  }

  function awaitCallback(): Promise<string | null> {
    // A second wait replaces the first: only one sign in is ever in flight, and it is the
    // one the person is looking at. The port stays open for it.
    settle(null);
    if (arrived) {
      const url = arrived;
      arrived = null;
      return Promise.resolve(url);
    }
    return new Promise((resolve) => {
      pending = resolve;
      timer = setTimeout(() => {
        log.info("auth callback timed out");
        done(null);
      }, waitMs);
    });
  }

  // Only https, so a renderer that got compromised cannot make the system open a file or a
  // scheme handler. Plain http only reaches this machine, where a local Supabase runs.
  async function open(url: unknown): Promise<boolean> {
    if (typeof url !== "string" || !isOpenable(url)) {
      log.warn("refused to open an external url", { url: typeof url === "string" ? url : "?" });
      return false;
    }
    try {
      await openUrl(url);
      log.info("sign in opened in the browser", { url });
      return true;
    } catch (error) {
      log.warn("the system refused to open the browser", { err: error });
      return false;
    }
  }

  return {
    redirectUrl,
    awaitCallback,
    captchaToken,
    open,
    cancel: () => {
      arrived = null;
      settleCaptcha(null);
      done(null);
    },
  };
}

export type Auth = ReturnType<typeof createAuth>;
