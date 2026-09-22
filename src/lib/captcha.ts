import { TURNSTILE_SCRIPT_URL } from "./endpoints.ts";

type Turnstile = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "timeout-callback": () => void;
    },
  ) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SOLVE_TIMEOUT_MS = 60_000;

let loading: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("turnstile script"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

// Only used when the app runs in a browser, where the origin is one the key can allow. A
// managed challenge is invisible most of the time, so the widget sits in a corner.
export async function inlineCaptchaToken(siteKey: string): Promise<string | null> {
  try {
    await loadTurnstile();
  } catch {
    return null;
  }
  const turnstile = window.turnstile;
  if (!turnstile) return null;

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:9999";
  document.body.appendChild(host);

  return new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (token: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      host.remove();
      resolve(token);
    };
    const timer = setTimeout(() => finish(null), SOLVE_TIMEOUT_MS);

    turnstile.render(host, {
      sitekey: siteKey,
      callback: finish,
      "error-callback": () => finish(null),
      "timeout-callback": () => finish(null),
    });
  });
}
