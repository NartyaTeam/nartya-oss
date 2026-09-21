import assert from "node:assert/strict";
import { test } from "node:test";
import { createResolver, type Query } from "./doh.mts";

function counting(answers: Record<string, string[]>): Query & { calls: number } {
  const query = async (hostname: string, type: "A" | "AAAA") => {
    query.calls += 1;
    return answers[`${hostname}|${type}`] ?? [];
  };
  query.calls = 0;
  return query;
}

test("prefers A records and falls back to AAAA", async () => {
  const both = counting({ "x.test|A": ["93.184.216.34"], "x.test|AAAA": ["2001:db8::1"] });
  assert.deepEqual(await createResolver(both)("x.test"), [{ address: "93.184.216.34", family: 4 }]);

  const onlyV6 = counting({ "x.test|AAAA": ["2001:db8::1"] });
  assert.deepEqual(await createResolver(onlyV6)("x.test"), [{ address: "2001:db8::1", family: 6 }]);
});

test("asks only AAAA when the caller wants ipv6", async () => {
  const query = counting({ "x.test|A": ["93.184.216.34"], "x.test|AAAA": ["2001:db8::1"] });
  const records = await createResolver(query)("x.test", 6);
  assert.deepEqual(records, [{ address: "2001:db8::1", family: 6 }]);
  assert.equal(query.calls, 1);
});

test("stays on ipv4 when the caller asks for it", async () => {
  const query = counting({ "x.test|AAAA": ["2001:db8::1"] });
  assert.deepEqual(await createResolver(query)("x.test", 4), []);
  assert.equal(query.calls, 1, "no AAAA fallback when the family is pinned");
});

test("serves the cache until it expires", async () => {
  const query = counting({ "x.test|A": ["93.184.216.34"] });
  const resolve = createResolver(query, 60_000);
  await resolve("x.test");
  await resolve("x.test");
  assert.equal(query.calls, 1);
});

test("does not cache an empty answer", async () => {
  const query = counting({});
  const resolve = createResolver(query, 60_000);
  await resolve("x.test");
  await resolve("x.test");
  assert.equal(query.calls, 4, "two lookups, each asking A then AAAA");
});

test("shares one request between concurrent callers", async () => {
  let started = 0;
  const query: Query = async () => {
    started += 1;
    await new Promise((done) => setTimeout(done, 10));
    return ["93.184.216.34"];
  };
  const resolve = createResolver(query);
  const [first, second] = await Promise.all([resolve("x.test"), resolve("x.test")]);
  assert.deepEqual(first, second);
  assert.equal(started, 1);
});
