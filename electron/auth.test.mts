import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuth, type CallbackServer } from "./auth.mts";

function fakeServer() {
  let deliver: ((url: string) => void) | null = null;
  const state = { started: 0, stopped: 0, port: null as number | null, ports: [8351] };

  const server: CallbackServer = {
    start: async (callback) => {
      state.started += 1;
      deliver = callback;
      state.port = state.ports[0] ?? null;
      return state.port;
    },
    redirectUrl: () =>
      state.port === null ? null : `http://127.0.0.1:${state.port}/auth-callback`,
    stop: () => {
      state.stopped += 1;
      state.port = null;
    },
  };

  return { server, state, call: (url: string) => deliver?.(url) };
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

test("a browser that refuses to open is an answer, not a crash", async () => {
  const { server } = fakeServer();
  const auth = createAuth({
    server,
    openUrl: () => Promise.reject(new Error("no handler")),
  });

  assert.equal(await auth.open("https://auth.example.test/authorize"), false);
});
