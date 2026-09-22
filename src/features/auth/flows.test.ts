import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthBridge } from "../../../shared/platform.ts";
import { CANCELLED, createAuthFlows } from "./flows.ts";

type Call = { name: string; argument: unknown };

function fakeClient(answers: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const answer = (name: string) => answers[name] ?? { data: {}, error: null };

  const auth = {
    signInWithPassword: async (argument: unknown) => {
      calls.push({ name: "signInWithPassword", argument });
      return answer("signInWithPassword");
    },
    signUp: async (argument: unknown) => {
      calls.push({ name: "signUp", argument });
      return answer("signUp");
    },
    signInWithOAuth: async (argument: unknown) => {
      calls.push({ name: "signInWithOAuth", argument });
      return answer("signInWithOAuth");
    },
    exchangeCodeForSession: async (argument: unknown) => {
      calls.push({ name: "exchangeCodeForSession", argument });
      return answer("exchangeCodeForSession");
    },
    resetPasswordForEmail: async (email: unknown, options: unknown) => {
      calls.push({ name: "resetPasswordForEmail", argument: { email, options } });
      return answer("resetPasswordForEmail");
    },
    updateUser: async (argument: unknown) => {
      calls.push({ name: "updateUser", argument });
      return answer("updateUser");
    },
    signOut: async () => {
      calls.push({ name: "signOut", argument: null });
      return answer("signOut");
    },
  };

  return { client: { auth } as unknown as SupabaseClient, calls };
}

function fakeBridge(callback: string | null) {
  const opened: string[] = [];
  const bridge: AuthBridge = {
    redirectUrl: async () => "http://127.0.0.1:8351/auth-callback",
    open: async (url) => {
      opened.push(url);
      return true;
    },
    awaitCallback: async () => callback,
    captchaToken: async () => "captcha-token",
    cancel: async () => {},
  };
  return { bridge, opened };
}

const desktop = (callback: string | null, answers: Record<string, unknown> = {}) => {
  const { client, calls } = fakeClient(answers);
  const { bridge, opened } = fakeBridge(callback);
  const flows = createAuthFlows({
    client,
    bridge,
    browserRedirect: (purpose) => `http://localhost:5173/auth-callback?flow=${purpose}`,
    captchaSiteKey: null,
    leaks: async () => 0,
  });
  return { flows, calls, opened };
};

test("signs in with a trimmed email", async () => {
  const { flows, calls } = desktop(null);
  assert.deepEqual(await flows.signIn("  someone@example.test ", "secret"), { error: null });
  assert.deepEqual(calls[0]?.argument, { email: "someone@example.test", password: "secret" });
});

test("a leaked password is refused before an account is created", async () => {
  const { client, calls } = fakeClient();
  const flows = createAuthFlows({
    client,
    bridge: null,
    browserRedirect: (purpose) => `http://localhost:5173/auth-callback?flow=${purpose}`,
    captchaSiteKey: null,
    leaks: async () => 42,
  });

  assert.deepEqual(await flows.signUp("someone@example.test", "hunter2", ""), {
    error: "pwned password",
  });
  assert.deepEqual(calls, [], "nothing was sent to the server");
});

test("a check that cannot run lets the sign up through", async () => {
  const { client, calls } = fakeClient({ signUp: { data: { session: {} }, error: null } });
  const flows = createAuthFlows({
    client,
    bridge: null,
    browserRedirect: (purpose) => `http://localhost:5173/auth-callback?flow=${purpose}`,
    captchaSiteKey: null,
    leaks: async () => null,
  });

  assert.deepEqual(await flows.signUp("someone@example.test", "hunter2", ""), {
    error: null,
    needsConfirm: false,
  });
  assert.equal(calls.length, 1);
});

test("falls back on the local part of the email for the display name", async () => {
  const { flows, calls } = desktop(null, { signUp: { data: { session: null }, error: null } });

  const result = await flows.signUp("Someone@example.test", "secret", "  ");
  assert.equal(result.needsConfirm, true, "no session means the email has to be confirmed");
  assert.deepEqual(calls[0]?.argument, {
    email: "Someone@example.test",
    password: "secret",
    options: { data: { full_name: "Someone" } },
  });
});

test("on the desktop, discord goes to the system browser and the code is exchanged", async () => {
  const { flows, calls, opened } = desktop("http://127.0.0.1:8351/auth-callback?code=abc123", {
    signInWithOAuth: { data: { url: "https://auth.example.test/authorize" }, error: null },
  });

  assert.deepEqual(await flows.signInWithDiscord(), { error: null });
  assert.deepEqual(opened, ["https://auth.example.test/authorize"]);
  assert.deepEqual(calls[0]?.argument, {
    provider: "discord",
    options: { redirectTo: "http://127.0.0.1:8351/auth-callback", skipBrowserRedirect: true },
  });
  assert.equal(calls[1]?.name, "exchangeCodeForSession");
  assert.equal(calls[1]?.argument, "abc123");
});

test("in a browser, the page redirects itself and nothing is exchanged here", async () => {
  const { client, calls } = fakeClient({
    signInWithOAuth: { data: { url: "https://auth.example.test/authorize" }, error: null },
  });
  const flows = createAuthFlows({
    client,
    bridge: null,
    browserRedirect: (purpose) => `http://localhost:5173/auth-callback?flow=${purpose}`,
    captchaSiteKey: null,
    leaks: async () => 0,
  });

  assert.deepEqual(await flows.signInWithDiscord(), { error: null });
  assert.deepEqual(calls[0]?.argument, {
    provider: "discord",
    options: {
      redirectTo: "http://localhost:5173/auth-callback?flow=oauth",
      skipBrowserRedirect: false,
    },
  });
  assert.equal(calls.length, 1);
});

test("a window closed without authorising is a cancellation, not an error", async () => {
  const { flows, calls } = desktop(null, {
    signInWithOAuth: { data: { url: "https://auth.example.test/authorize" }, error: null },
  });

  assert.deepEqual(await flows.signInWithDiscord(), { error: CANCELLED });
  assert.equal(calls.length, 1, "no code, so nothing to exchange");
});

test("a callback without a code is a cancellation too", async () => {
  const { flows } = desktop("http://127.0.0.1:8351/auth-callback?error=access_denied", {
    signInWithOAuth: { data: { url: "https://auth.example.test/authorize" }, error: null },
  });

  assert.deepEqual(await flows.signInWithDiscord(), { error: CANCELLED });
  assert.deepEqual(await flows.exchange("not a url"), { error: CANCELLED });
});

test("the recovery mail comes back to this app, which waits for the link", async () => {
  const { flows, calls } = desktop("http://127.0.0.1:8351/auth-callback?code=recover");

  assert.deepEqual(await flows.requestPasswordReset(" someone@example.test "), {
    error: null,
    sent: true,
    recovered: true,
  });
  assert.deepEqual(calls[0]?.argument, {
    email: "someone@example.test",
    options: { redirectTo: "http://127.0.0.1:8351/auth-callback" },
  });
  assert.equal(calls[1]?.name, "exchangeCodeForSession");
});

test("a recovery mail that is never opened is sent, but opens no session", async () => {
  const { flows } = desktop(null);
  assert.deepEqual(await flows.requestPasswordReset("someone@example.test"), {
    error: CANCELLED,
    sent: true,
    recovered: false,
  });
});

test("in a browser the mail is sent and the link reopens the page later", async () => {
  const { client } = fakeClient();
  const flows = createAuthFlows({
    client,
    bridge: null,
    browserRedirect: (purpose) => `http://localhost:5173/auth-callback?flow=${purpose}`,
    captchaSiteKey: null,
    leaks: async () => 0,
  });

  const result = await flows.requestPasswordReset("someone@example.test");
  assert.equal(result.recovered, undefined, "no session is opened here, so no screen change");
  assert.deepEqual(result, { error: null, sent: true });
});

test("the new password is checked against the leaks as well", async () => {
  const { client, calls } = fakeClient();
  const leaked = createAuthFlows({
    client,
    bridge: null,
    browserRedirect: (purpose) => `http://localhost:5173/auth-callback?flow=${purpose}`,
    captchaSiteKey: null,
    leaks: async () => 1,
  });
  assert.deepEqual(await leaked.setPassword("hunter2"), { error: "pwned password" });
  assert.deepEqual(calls, []);

  const { flows, calls: fresh } = desktop(null);
  assert.deepEqual(await flows.setPassword("a-long-unlikely-passphrase"), { error: null });
  assert.deepEqual(fresh[0]?.argument, { password: "a-long-unlikely-passphrase" });
});

test("with bot protection on, the token travels with every call", async () => {
  const { client, calls } = fakeClient({
    signUp: { data: { session: {} }, error: null },
  });
  const { bridge } = fakeBridge(null);
  const asked: string[] = [];
  const flows = createAuthFlows({
    client,
    bridge: { ...bridge, captchaToken: async (key) => (asked.push(key), "from-loopback") },
    browserRedirect: (purpose) => `http://localhost:5173/auth-callback?flow=${purpose}`,
    captchaSiteKey: "0x4AAAAAAEFfyKPirwZPGekW",
    leaks: async () => 0,
  });

  await flows.signIn("someone@example.test", "secret");
  await flows.signUp("someone@example.test", "secret", "Zeleff");
  await flows.requestPasswordReset("someone@example.test");

  assert.deepEqual(asked, Array(3).fill("0x4AAAAAAEFfyKPirwZPGekW"));
  assert.deepEqual((calls[0]?.argument as { options: unknown }).options, {
    captchaToken: "from-loopback",
  });
  assert.deepEqual((calls[1]?.argument as { options: unknown }).options, {
    data: { full_name: "Zeleff" },
    captchaToken: "from-loopback",
  });
  assert.deepEqual((calls[2]?.argument as { options: unknown }).options, {
    redirectTo: "http://127.0.0.1:8351/auth-callback",
    captchaToken: "from-loopback",
  });
});

test("in a browser the widget is rendered in the page instead", async () => {
  const { client, calls } = fakeClient();
  const asked: string[] = [];
  const flows = createAuthFlows({
    client,
    bridge: null,
    browserRedirect: (purpose) => `http://localhost:5173/auth-callback?flow=${purpose}`,
    captchaSiteKey: "0x4AAAAAAEFfyKPirwZPGekW",
    leaks: async () => 0,
    captcha: async (key) => (asked.push(key), "from-widget"),
  });

  await flows.signIn("someone@example.test", "secret");
  assert.deepEqual(asked, ["0x4AAAAAAEFfyKPirwZPGekW"]);
  assert.deepEqual((calls[0]?.argument as { options: unknown }).options, {
    captchaToken: "from-widget",
  });
});

test("a captcha nobody could solve sends the call without a token, and the server says so", async () => {
  const { client, calls } = fakeClient();
  const flows = createAuthFlows({
    client,
    bridge: null,
    browserRedirect: (purpose) => `http://localhost:5173/auth-callback?flow=${purpose}`,
    captchaSiteKey: "0x4AAAAAAEFfyKPirwZPGekW",
    leaks: async () => 0,
    captcha: async () => null,
  });

  await flows.signIn("someone@example.test", "secret");
  assert.deepEqual(calls[0]?.argument, {
    email: "someone@example.test",
    password: "secret",
  });
});
