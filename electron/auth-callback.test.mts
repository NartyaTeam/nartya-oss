import assert from "node:assert/strict";
import http from "node:http";
import { test, type TestContext } from "node:test";
import { createAuthCallbackServer, escapeHtml, oauthErrorCopy } from "./auth-callback.mts";

// One base per test: fetch keeps connections alive, and reusing a port across tests
// hands the next server a socket that belongs to the previous one.
const portsFrom = (base: number) => [base, base + 1, base + 2];

test("escapes what goes into the page", () => {
  assert.equal(
    escapeHtml(`<script>"x"&'y'</script>`),
    "&lt;script&gt;&quot;x&quot;&amp;&#039;y&#039;&lt;/script&gt;",
  );
});

test("names the two failures a user can act on", () => {
  const linked = new URLSearchParams({
    error_description: "Identity+is+already+linked+to+another+user",
  });
  assert.equal(oauthErrorCopy(linked).title, "Ce compte est déjà utilisé");

  const denied = new URLSearchParams({ error: "access_denied" });
  assert.equal(oauthErrorCopy(denied).title, "Autorisation annulée");

  assert.equal(oauthErrorCopy(new URLSearchParams()).title, "Échec de la connexion");
});

test("serves the callback and reports the full url", async (t: TestContext) => {
  const ports = portsFrom(18351);
  const server = createAuthCallbackServer(ports);
  const received: string[] = [];
  const port = await server.start((url) => received.push(url));
  t.after(() => server.stop());

  assert.equal(port, ports[0]);
  assert.equal(server.redirectUrl(), `http://127.0.0.1:${String(port)}/auth-callback`);

  const response = await fetch(`http://127.0.0.1:${String(port)}/auth-callback?code=abc`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Connexion réussie/);
  assert.deepEqual(received, [`http://127.0.0.1:${String(port)}/auth-callback?code=abc`]);

  const missing = await fetch(`http://127.0.0.1:${String(port)}/elsewhere`);
  assert.equal(missing.status, 404);
});

test("shows the error page when the provider sends no code", async (t: TestContext) => {
  const server = createAuthCallbackServer(portsFrom(18361));
  const port = await server.start(() => {});
  t.after(() => server.stop());

  const response = await fetch(
    `http://127.0.0.1:${String(port)}/auth-callback?error=access_denied`,
  );
  assert.match(await response.text(), /Autorisation annulée/);
});

test("moves to the next port when the first is taken", async (t: TestContext) => {
  const ports = portsFrom(18371);
  const squatter = http.createServer();
  await new Promise<void>((done) => squatter.listen(ports[0], "127.0.0.1", done));

  const server = createAuthCallbackServer(ports);
  const port = await server.start(() => {});
  t.after(() => {
    server.stop();
    squatter.close();
  });

  assert.equal(port, ports[1]);
});

test("reports no port when every candidate is taken", async (t: TestContext) => {
  const ports = portsFrom(18381);
  const squatters = ports.map(() => http.createServer());
  await Promise.all(
    squatters.map(
      (squatter, index) =>
        new Promise<void>((done) => squatter.listen(ports[index], "127.0.0.1", done)),
    ),
  );
  t.after(() => squatters.forEach((squatter) => squatter.close()));

  const server = createAuthCallbackServer(ports);
  assert.equal(await server.start(() => {}), null);
  assert.equal(server.redirectUrl(), null);
});
