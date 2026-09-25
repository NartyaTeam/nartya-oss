import assert from "node:assert/strict";
import { test } from "node:test";
import { useNetwork } from "./store.ts";

const settled = () => new Promise((done) => setTimeout(done, 0));
const fresh = () => useNetwork.setState({ online: true, checked: false });
const noWait = async () => undefined;

function probeAnswering(...answers: boolean[]) {
  const calls = { count: 0 };
  const probe = async () => answers[Math.min(calls.count++, answers.length - 1)] ?? false;
  return { probe, calls };
}

test("an answering api confirms the network at once", async () => {
  fresh();
  const { probe, calls } = probeAnswering(true);
  const stop = useNetwork.getState().watch(probe, new EventTarget(), noWait);
  await settled();

  assert.deepEqual(
    { online: useNetwork.getState().online, checked: useNetwork.getState().checked },
    { online: true, checked: true },
  );
  assert.equal(calls.count, 1);
  stop();
});

test("one missed probe at start is not offline", async () => {
  fresh();
  const { probe } = probeAnswering(false, true);
  const stop = useNetwork.getState().watch(probe, new EventTarget(), noWait);
  await settled();

  assert.equal(useNetwork.getState().online, true);
  stop();
});

test("three missed probes in a row are offline", async () => {
  fresh();
  const { probe, calls } = probeAnswering(false);
  const stop = useNetwork.getState().watch(probe, new EventTarget(), noWait);
  await settled();

  assert.equal(calls.count, 3);
  assert.equal(useNetwork.getState().online, false);
  assert.equal(useNetwork.getState().checked, true);
  stop();
});

test("nothing is decided before the first probe answers", () => {
  fresh();
  const stop = useNetwork.getState().watch(() => new Promise(() => {}), new EventTarget(), noWait);

  assert.equal(useNetwork.getState().checked, false);
  stop();
});

test("the system losing the network is offline at once, and its return is checked", async () => {
  fresh();
  const events = new EventTarget();
  const { probe, calls } = probeAnswering(true);
  const stop = useNetwork.getState().watch(probe, events, noWait);
  await settled();

  events.dispatchEvent(new Event("offline"));
  assert.equal(useNetwork.getState().online, false);

  events.dispatchEvent(new Event("online"));
  await settled();
  assert.equal(calls.count, 2);
  assert.equal(useNetwork.getState().online, true);
  stop();
});

test("a probe answering after the watch stopped changes nothing", async () => {
  fresh();
  let answer: (up: boolean) => void = () => undefined;
  let first = true;
  const probe = (): Promise<boolean> => {
    if (!first) return Promise.resolve(false);
    first = false;
    return new Promise<boolean>((done) => (answer = done));
  };
  const stop = useNetwork.getState().watch(probe, new EventTarget(), noWait);

  stop();
  answer(false);
  await settled();
  assert.equal(useNetwork.getState().checked, false);
});
