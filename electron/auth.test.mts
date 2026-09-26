import assert from "node:assert/strict";
import { test } from "node:test";
import type { Handlers } from "./auth-callback.mts";
import { createAuth, type CallbackServer } from "./auth.mts";

function fakeServer() {
  let live: Handlers | null = null;
  const state = { started: 0, stopped: 0, port: null as number | null, ports: [8351] };

  const server: CallbackServer = {
    start: async (handlers) => {
      state.started += 1;
      live = handlers;
      state.port = state.ports[0] ?? null;
      return state.port;
    },
    redirectUrl: () =>
      state.port === null ? null : `http://127.0.0.1:${state.port}/auth-callback`,
    captchaUrl: (siteKey) =>
      state.port === null ? null : `http://127.0.0.1:${state.port}/captcha?key=${siteKey}`,
    stop: () => {
      state.stopped += 1;
      state.port = null;
    },
  };

  return {
    server,
    state,
    call: (url: string) => live?.onCallback(url),
    solve: (token: string) => live?.onCaptcha(token),
  };
}

const tick = () => new Promise((done) => setImmediate(done));

test("hands out a loopback redirect and starts the server once", async () => {
  const { server, state } = fakeServer();
  const auth = createAuth({ server, openUrl: async () => {} });

  assert.equal(await auth.redirectUrl(), "http://127.0.0.1:8351/auth-callback");
  assert.equal(await auth.redirectUrl(), "http://127.0.0.1:8351/auth-callback");
  assert.equal(state.started, 1);
});

test("says so when no port is free rather than pretending", async () => {
  const { server, state } = fakeServer();
  state.ports = [];
  const auth = createAuth({ server, openUrl: async () => {} });

  assert.equal(await auth.redirectUrl(), null);
});

test("resolves the wait with the callback url, then closes the port", async () => {
  const { server, state, call } = fakeServer();
  const auth = createAuth({ server, openUrl: async () => {} });
  await auth.redirectUrl();

  const waiting = auth.awaitCallback();
  call("http://127.0.0.1:8351/auth-callback?code=abc");
  assert.equal(await waiting, "http://127.0.0.1:8351/auth-callback?code=abc");

  await tick();
  assert.equal(state.stopped, 1);
});

test("a second sign in replaces the first without closing the port under it", async () => {
  const { server, state, call } = fakeServer();
  const auth = createAuth({ server, openUrl: async () => {} });
  await auth.redirectUrl();

  const abandoned = auth.awaitCallback();
  const current = auth.awaitCallback();
  assert.equal(await abandoned, null);
  assert.equal(state.stopped, 0, "closing here would drop the callback of the live attempt");

  call("http://127.0.0.1:8351/auth-callback?code=second");
  assert.equal(await current, "http://127.0.0.1:8351/auth-callback?code=second");
});

test("gives up after the wait, and cancelling resolves with nothing", async () => {
  const { server, state } = fakeServer();
  const auth = createAuth({ server, openUrl: async () => {}, waitMs: 5 });
  await auth.redirectUrl();

  assert.equal(await auth.awaitCallback(), null);
  await tick();
  assert.equal(state.stopped, 1);

  await auth.redirectUrl();
  const waiting = auth.awaitCallback();
  auth.cancel();
  assert.equal(await waiting, null);
});

test("opens https only, whatever the renderer asks for", async () => {
  const opened: string[] = [];
  const { server } = fakeServer();
  const auth = createAuth({ server, openUrl: async (url) => void opened.push(url) });

  assert.equal(await auth.open("https://auth.example.test/authorize?p=discord"), true);
  assert.equal(await auth.open("http://auth.example.test/authorize"), false);
  assert.equal(await auth.open("file:///etc/passwd"), false);
  assert.equal(await auth.open("javascript:alert(1)"), false);
  assert.equal(await auth.open(42), false);
  assert.deepEqual(opened, ["https://auth.example.test/authorize?p=discord"]);
});

test("a local Supabase is opened over http, and no other host is", async () => {
  const opened: string[] = [];
  const { server } = fakeServer();
  const auth = createAuth({ server, openUrl: async (url) => void opened.push(url) });

  assert.equal(await auth.open("http://127.0.0.1:54321/auth/v1/authorize?provider=discord"), true);
  assert.equal(await auth.open("http://localhost:54321/auth/v1/authorize"), true);
  assert.equal(await auth.open("http://[::1]:54321/auth/v1/authorize"), true);
  assert.equal(await auth.open("http://127.0.0.1.example.test/authorize"), false);
  assert.equal(await auth.open("http://192.168.1.10:54321/authorize"), false);
  assert.equal(opened.length, 3);
});

test("a browser that refuses to open is an answer, not a crash", async () => {
  const { server } = fakeServer();
  const auth = createAuth({
    server,
    openUrl: () => Promise.reject(new Error("no handler")),
  });

  assert.equal(await auth.open("https://auth.example.test/authorize"), false);
});

test("opens its own captcha page and hands the token back", async () => {
  const opened: string[] = [];
  const { server, state, solve } = fakeServer();
  const auth = createAuth({ server, openUrl: async (url) => void opened.push(url) });

  const waiting = auth.captchaToken("0x4AAAAAAEFfyKPirwZPGekW");
  await tick();
  // Ours, on loopback, so it is opened without going through the https rule.
  assert.deepEqual(opened, ["http://127.0.0.1:8351/captcha?key=0x4AAAAAAEFfyKPirwZPGekW"]);

  solve("solved");
  assert.equal(await waiting, "solved");
  await tick();
  assert.equal(state.stopped, 1);
});

test("a site key that is not one opens nothing", async () => {
  const opened: string[] = [];
  const { server, state } = fakeServer();
  const auth = createAuth({ server, openUrl: async (url) => void opened.push(url) });

  assert.equal(await auth.captchaToken(""), null);
  assert.equal(await auth.captchaToken(undefined), null);
  assert.deepEqual(opened, []);
  assert.equal(state.started, 0);
});

test("an unsolved captcha gives up and closes the port", async () => {
  const { server, state } = fakeServer();
  const auth = createAuth({ server, openUrl: async () => {}, waitMs: 5 });

  assert.equal(await auth.captchaToken("0x4AAAAAAEFfyKPirwZPGekW"), null);
  await tick();
  assert.equal(state.stopped, 1);
});

test("a captcha solved mid sign in leaves the port open for the callback", async () => {
  const { server, state, call, solve } = fakeServer();
  const auth = createAuth({ server, openUrl: async () => {} });
  await auth.redirectUrl();

  const signingIn = auth.awaitCallback();
  const captcha = auth.captchaToken("0x4AAAAAAEFfyKPirwZPGekW");
  await tick();
  solve("solved");
  assert.equal(await captcha, "solved");

  await tick();
  assert.equal(state.stopped, 0, "the sign in still needs the port");

  call("http://127.0.0.1:8351/auth-callback?code=abc");
  assert.equal(await signingIn, "http://127.0.0.1:8351/auth-callback?code=abc");
  await tick();
  assert.equal(state.stopped, 1);
});

test("a callback that lands before anyone waits is not lost", async () => {
  const { server, call } = fakeServer();
  const auth = createAuth({ server, openUrl: async () => {} });
  await auth.redirectUrl();

  // The browser can come back between opening it and starting to wait.
  call("http://127.0.0.1:8351/auth-callback?code=early");
  assert.equal(await auth.awaitCallback(), "http://127.0.0.1:8351/auth-callback?code=early");
});

test("the buffered callback belongs to the sign in that asked for it", async () => {
  const { server, call } = fakeServer();
  const auth = createAuth({ server, openUrl: async () => {}, waitMs: 5 });

  await auth.redirectUrl();
  call("http://127.0.0.1:8351/auth-callback?code=abandoned");

  // Asking for a redirect again is a new attempt, so the old answer is not its answer.
  await auth.redirectUrl();
  assert.equal(await auth.awaitCallback(), null);
});
