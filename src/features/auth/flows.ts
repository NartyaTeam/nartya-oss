import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthBridge } from "../../../shared/platform.ts";
import { countPasswordLeaks } from "../../lib/password-safety.ts";

export type AuthResult = {
  error: string | null;
  needsConfirm?: boolean;
  sent?: boolean;
  recovered?: boolean;
};

export type Purpose = "oauth" | "recovery";

export type FlowParts = {
  client: SupabaseClient;
  bridge: AuthBridge | null;
  // Only used without the desktop bridge: the browser comes back to the page itself, and
  // the purpose has to survive the round trip to know which screen to show on return.
  browserRedirect: (purpose: Purpose) => string;
  leaks?: typeof countPasswordLeaks;
};

export const CANCELLED = "cancelled";

export function createAuthFlows(parts: FlowParts) {
  const { client, bridge, browserRedirect } = parts;
  const leaks = parts.leaks ?? countPasswordLeaks;

  // A leaked password is refused; a check that could not run is not a reason to refuse.
  async function isLeaked(password: string): Promise<boolean> {
    return ((await leaks(password)) ?? 0) > 0;
  }

  async function signIn(email: string, password: string): Promise<AuthResult> {
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, displayName: string): Promise<AuthResult> {
    if (await isLeaked(password)) return { error: "pwned password" };

    const clean = email.trim();
    const name = displayName.trim() || clean.split("@")[0] || "";
    const { data, error } = await client.auth.signUp({
      email: clean,
      password,
      options: name ? { data: { full_name: name } } : undefined,
    });
    if (error) return { error: error.message };
    return { error: null, needsConfirm: !data.session };
  }

  // The provider page opens in the system browser, never inside the app: an embedded view
  // would put us between someone and their provider password, and providers refuse it.
  async function signInWithDiscord(): Promise<AuthResult> {
    const redirectTo = (await bridge?.redirectUrl()) ?? browserRedirect("oauth");
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo, skipBrowserRedirect: bridge !== null },
    });
    if (error) return { error: error.message };
    if (!bridge) return { error: null };

    if (!(await bridge.open(data.url))) return { error: "failed to send" };
    return waitAndExchange();
  }

  async function waitAndExchange(): Promise<AuthResult> {
    const callback = await bridge?.awaitCallback();
    if (!callback) return { error: CANCELLED };
    return exchange(callback);
  }

  async function exchange(callbackUrl: string): Promise<AuthResult> {
    let code: string | null = null;
    try {
      code = new URL(callbackUrl).searchParams.get("code");
    } catch {
      return { error: CANCELLED };
    }
    if (!code) return { error: CANCELLED };

    const { error } = await client.auth.exchangeCodeForSession(code);
    return { error: error?.message ?? null };
  }

  // The recovery link lands on the same loopback callback, so this app has to be the one
  // waiting for it: the person is sent back here rather than to a web page we would host.
  async function requestPasswordReset(email: string): Promise<AuthResult> {
    const redirectTo = (await bridge?.redirectUrl()) ?? browserRedirect("recovery");
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) return { error: error.message };
    // In a browser the link reopens the page, so nothing more happens here.
    if (!bridge) return { error: null, sent: true };

    const exchanged = await waitAndExchange();
    return { ...exchanged, sent: true, recovered: exchanged.error === null };
  }

  async function setPassword(password: string): Promise<AuthResult> {
    if (await isLeaked(password)) return { error: "pwned password" };
    const { error } = await client.auth.updateUser({ password });
    return { error: error?.message ?? null };
  }

  return {
    signIn,
    signUp,
    signInWithDiscord,
    requestPasswordReset,
    setPassword,
    exchange,
    signOut: () => client.auth.signOut(),
    cancel: () => bridge?.cancel(),
  };
}

export type AuthFlows = ReturnType<typeof createAuthFlows>;
