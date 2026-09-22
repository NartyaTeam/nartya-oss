import assert from "node:assert/strict";
import { test } from "node:test";
import { createResolver, StreamError, type ResolveParts } from "./stream-resolve.mts";

const parts = (over: Partial<ResolveParts> = {}): ResolveParts => ({
  unseal: () => Promise.resolve({ url: "https://host.example.test/e/1", provider: "s1" }),
  readPage: () => Promise.resolve("<html></html>"),
  extract: () => ({ ok: true, url: "https://cdn.example.test/master.m3u8" }),
  consistent: () => true,
  mint: () => "handle-1",
  ...over,
});

test("a token becomes a handle, and hls is named rather than guessed", async () => {
  const answer = await createResolver(parts()).resolve("token");
  assert.deepEqual(answer, { ok: true, value: { handle: "handle-1", isHls: true } });

  const mp4 = createResolver(
    parts({ extract: () => ({ ok: true, url: "https://cdn.test/v.mp4" }) }),
  );
  assert.deepEqual(await mp4.resolve("token"), {
    ok: true,
    value: { handle: "handle-1", isHls: false },
  });
});

test("the embed page is what the segments are fetched on behalf of", async () => {
  let seen: unknown = null;
  const resolver = createResolver(
    parts({
      mint: (target) => {
        seen = target;
        return "handle-1";
      },
    }),
  );
  await resolver.resolve("token");
  assert.deepEqual(seen, {
    url: "https://cdn.example.test/master.m3u8",
    provider: "s1",
    referer: "https://host.example.test/e/1",
    origin: "https://host.example.test",
  });
});

test("the same token twice does not go back out to the host", async () => {
  let calls = 0;
  const resolver = createResolver(
    parts({
      unseal: () => {
        calls += 1;
        return Promise.resolve({ url: "https://host.example.test/e/1", provider: null });
      },
    }),
  );

  await resolver.resolve("token");
  await resolver.resolve("token");
  assert.equal(calls, 1);

  await resolver.resolve("token", true);
  assert.equal(calls, 2);
});

test("what the cache holds goes stale, so an expiring link is asked for again", async () => {
  let clock = 0;
  let calls = 0;
  const resolver = createResolver(
    parts({
      ttlMs: 1000,
      now: () => clock,
      unseal: () => {
        calls += 1;
        return Promise.resolve({ url: "https://host.example.test/e/1", provider: null });
      },
    }),
  );

  await resolver.resolve("token");
  clock = 999;
  await resolver.resolve("token");
  assert.equal(calls, 1);
  clock = 1001;
  await resolver.resolve("token");
  assert.equal(calls, 2);
});

test("the api's own words reach the viewer, anything else stays vague", async () => {
  const told = createResolver(
    parts({ unseal: () => Promise.reject(new StreamError("Lien expiré, recharge l'épisode.")) }),
  );
  assert.deepEqual(await told.resolve("token"), {
    ok: false,
    error: "Lien expiré, recharge l'épisode.",
  });

  const broke = createResolver(parts({ unseal: () => Promise.reject(new Error("ECONNRESET")) }));
  assert.deepEqual(await broke.resolve("token"), { ok: false, error: "Source injoignable" });
});

test("a host serving someone else's embed is not a stream", async () => {
  const resolver = createResolver(parts({ consistent: () => false }));
  assert.deepEqual(await resolver.resolve("token"), {
    ok: false,
    error: "Flux extrait incohérent avec la source",
  });
});

test("a failure is never cached, so a retry is a real retry", async () => {
  let calls = 0;
  const resolver = createResolver(
    parts({
      readPage: () => {
        calls += 1;
        return Promise.reject(new Error("down"));
      },
    }),
  );

  await resolver.resolve("token");
  await resolver.resolve("token");
  assert.equal(calls, 2);
});

test("an empty token is refused before anything goes out", async () => {
  let calls = 0;
  const resolver = createResolver(
    parts({
      unseal: () => {
        calls += 1;
        return Promise.resolve({ url: "x", provider: null });
      },
    }),
  );
  assert.deepEqual(await resolver.resolve(""), { ok: false, error: "Source invalide" });
  assert.equal(calls, 0);
});
