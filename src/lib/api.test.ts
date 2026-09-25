import assert from "node:assert/strict";
import { test } from "node:test";
import { createApi, type ApiParts } from "./api.ts";

type Answer = { status: number; body?: unknown; throws?: boolean };

function apiWith(answers: Answer[], token: string | null = "jwt") {
  const asked: { url: string; headers: Record<string, string> }[] = [];
  const waits: number[] = [];
  let next = 0;

  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const answer = answers[Math.min(next, answers.length - 1)];
    next += 1;
    asked.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
    if (!answer || answer.throws) throw new Error("network");
    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      json: async () => answer.body,
    } as Response;
  }) as ApiParts["fetcher"];

  const api = createApi({
    baseUrl: "https://api.example.test",
    token: async () => token,
    version: "0.1.0",
    platform: "desktop",
    fetcher,
    wait: async (ms) => void waits.push(ms),
  });

  return { api, asked, waits, calls: () => next };
}

test("returns the data inside the envelope", async () => {
  const { api, asked } = apiWith([{ status: 200, body: { success: true, data: { rows: [1] } } }]);
  const result = await api.get<{ rows: number[] }>("/home/sections");

  assert.deepEqual(result, { ok: true, data: { rows: [1] } });
  assert.equal(asked[0]?.url, "https://api.example.test/home/sections");
});

test("carries the session and declares the version", async () => {
  const { api, asked } = apiWith([{ status: 200, body: { success: true, data: 1 } }]);
  await api.get("/home/sections");

  assert.deepEqual(asked[0]?.headers, {
    "x-nartya-app-version": "0.1.0",
    "x-nartya-platform": "desktop",
    Authorization: "Bearer jwt",
  });
});

test("signed out, the call still goes, without the header", async () => {
  const { api, asked } = apiWith([{ status: 200, body: { success: true, data: 1 } }], null);
  await api.get("/home/sections");

  assert.equal(asked[0]?.headers["Authorization"], undefined);
  assert.equal(asked[0]?.headers["x-nartya-app-version"], "0.1.0");
});

test("retries what is transient, with a growing pause", async () => {
  const { api, waits, calls } = apiWith([
    { status: 0, throws: true },
    { status: 503 },
    { status: 200, body: { success: true, data: "late" } },
  ]);

  assert.deepEqual(await api.get("/home/sections"), { ok: true, data: "late" });
  assert.equal(calls(), 3);
  assert.deepEqual(waits, [400, 800]);
});

test("gives up after the retries, saying it could not be reached", async () => {
  const { api, calls } = apiWith([{ status: 0, throws: true }]);
  const result = await api.get("/home/sections");

  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /injoignable/);
  assert.equal(calls(), 3);
});

test("a 4xx is an answer, not a hiccup", async () => {
  const { api, calls } = apiWith([{ status: 404 }]);
  const result = await api.get("/home/sections");

  assert.equal(result.ok, false);
  assert.equal(calls(), 1, "retrying makes the same mistake three times");
});

test("an out of date client is told exactly that", async () => {
  const { api, calls } = apiWith([{ status: 426, body: { success: false } }]);
  const result = await api.get("/home/sections");

  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.outdated, true);
  assert.equal(calls(), 1);
});

test("an envelope that says no is not retried either", async () => {
  const { api, calls } = apiWith([
    { status: 200, body: { success: false, error: "Catalogue en reconstruction" } },
  ]);
  const result = await api.get("/home/sections");

  assert.equal(result.ok === false && result.message, "Catalogue en reconstruction");
  assert.equal(calls(), 1);
});

test("a body without data is a failure, not an undefined sneaking through", async () => {
  const { api } = apiWith([{ status: 200, body: { success: true } }]);
  const result = await api.get("/home/sections");

  assert.equal(result.ok, false);
});

test("a refused session says so, rather than blaming the catalogue", async () => {
  const { api, calls } = apiWith([{ status: 401, body: { success: false } }]);
  const result = await api.get("/home/sections");

  assert.match(result.ok === false ? result.message : "", /Reconnecte-toi/);
  assert.equal(result.ok === false && result.outdated, false);
  assert.equal(calls(), 1);
});

test("the api answering at all, even with an error, means the network is up", async () => {
  assert.equal(await apiWith([{ status: 200 }]).api.reachable(), true);
  assert.equal(await apiWith([{ status: 503 }]).api.reachable(), true);
});

test("a request that never reaches the api means no network", async () => {
  const { api, asked } = apiWith([{ status: 0, throws: true }]);
  assert.equal(await api.reachable(), false);
  assert.equal(asked[0]?.url, "https://api.example.test/health");
});
