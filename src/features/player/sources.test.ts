import assert from "node:assert/strict";
import { test } from "node:test";
import type { Source } from "../anime/types.ts";
import { orderSources, resolveHedged } from "./sources.ts";

const source = (slot: string, rank: number): Source => ({
  id: `token-${slot}`,
  key: slot,
  label: slot.toUpperCase(),
  rank,
  recommended: false,
  slot,
});

const all = [source("eps1", 1), source("eps2", 2), source("eps3", 3)];

// A stagger the test drives by hand, so nothing waits on a real clock.
function manualDelay() {
  const armed: (() => void)[] = [];
  const delay = () => {
    let fire = (): void => undefined;
    const promise = new Promise<void>((resolve) => {
      fire = resolve;
    });
    armed.push(fire);
    return { promise, cancel: () => undefined };
  };
  return { delay, tick: () => armed.shift()?.() };
}

test("automatic keeps the order the api ranked", () => {
  assert.deepEqual(
    orderSources(all).map((entry) => entry.slot),
    ["eps1", "eps2", "eps3"],
  );
});

test("a source picked by hand is the only one tried", () => {
  assert.deepEqual(
    orderSources(all, "eps2").map((entry) => entry.slot),
    ["eps2"],
  );
});

test("a chosen source the episode does not carry plays nothing, rather than something else", () => {
  assert.deepEqual(orderSources(all, "eps9"), []);
});

test("a chosen source that failed hands back to the automatic order", () => {
  assert.deepEqual(
    orderSources(all, "eps2", ["eps2"]).map((entry) => entry.slot),
    ["eps1", "eps3"],
  );
});

const onHost = (slot: string, key: string, rank: number): Source => ({
  ...source(slot, rank),
  key,
});

test("a picked source is a host, found under whichever slot carries it", () => {
  const episode = [onHost("eps1", "s5", 1), onHost("eps2", "s1", 2), onHost("eps3", "s6", 3)];
  assert.deepEqual(
    orderSources(episode, "s1").map((entry) => entry.slot),
    ["eps2"],
  );
});

test("a host under two slots is tried under both before giving up on it", () => {
  const episode = [onHost("eps1", "s1", 1), onHost("eps2", "s1", 2), onHost("eps3", "s5", 3)];
  assert.deepEqual(
    orderSources(episode, "s1").map((entry) => entry.slot),
    ["eps1", "eps2"],
  );
  assert.deepEqual(
    orderSources(episode, "s1", ["eps1"]).map((entry) => entry.slot),
    ["eps2"],
  );
  assert.deepEqual(
    orderSources(episode, "s1", ["eps1", "eps2"]).map((entry) => entry.slot),
    ["eps3"],
  );
});

test("the first to produce something playable wins", async () => {
  const { delay, tick } = manualDelay();
  const won = resolveHedged(
    all,
    (entry) =>
      entry.slot === "eps2"
        ? Promise.resolve({ ok: true as const, value: "url-2" })
        : new Promise(() => undefined),
    { delay },
  );
  tick();
  assert.deepEqual(await won, { ok: true, value: "url-2", source: all[1] });
});

test("a source that fails does not wait for the stagger before the next goes out", async () => {
  const tried: string[] = [];
  const won = await resolveHedged(
    all,
    (entry) => {
      tried.push(entry.slot);
      return entry.slot === "eps3"
        ? Promise.resolve({ ok: true as const, value: "url-3" })
        : Promise.resolve({ ok: false as const, error: "mort" });
    },
    { delay: manualDelay().delay },
  );

  assert.deepEqual(tried, ["eps1", "eps2", "eps3"]);
  assert.equal(won.ok && won.value, "url-3");
});

test("every source failing says so, with what the first two said", async () => {
  const won = await resolveHedged(
    all,
    (entry) => Promise.resolve({ ok: false as const, error: `${entry.slot} cassée` }),
    { delay: manualDelay().delay },
  );
  assert.equal(won.ok, false);
  assert.match(won.ok === false ? won.error : "", /EPS1: eps1 cassée, EPS2: eps2 cassée/);
});

test("a source that throws counts as a failure, not as a crash", async () => {
  const won = await resolveHedged(
    all,
    (entry) =>
      entry.slot === "eps1"
        ? Promise.reject(new Error("boom"))
        : Promise.resolve({ ok: true as const, value: "url-2" }),
    { delay: manualDelay().delay },
  );
  assert.equal(won.ok && won.value, "url-2");
});

test("no source at all is said plainly, without trying anything", async () => {
  let calls = 0;
  const won = await resolveHedged([], () => {
    calls += 1;
    return Promise.resolve({ ok: true as const, value: "x" });
  });
  assert.deepEqual(won, { ok: false, error: "Aucune source pour cet épisode." });
  assert.equal(calls, 0);
});

test("a slow first source does not hold the others back", async () => {
  const { delay, tick } = manualDelay();
  const tried: string[] = [];
  const won = resolveHedged(
    all,
    (entry) => {
      tried.push(entry.slot);
      return entry.slot === "eps1"
        ? new Promise(() => undefined)
        : Promise.resolve({ ok: true as const, value: `url-${entry.slot}` });
    },
    { delay },
  );

  assert.deepEqual(tried, ["eps1"]);
  tick();
  assert.equal((await won).ok, true);
  assert.deepEqual(tried, ["eps1", "eps2"]);
});
