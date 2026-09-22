import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CAST_SERVICE,
  createCastRegistry,
  parseTxt,
  prettyInstance,
  type Packet,
} from "./cast-registry.mts";

const instance = `Chromecast-Ultra-3f2a91bb77cc4410.${CAST_SERVICE}`;

function announcement(withAddress = true): Packet {
  return {
    answers: [
      { name: CAST_SERVICE, type: "PTR", data: instance },
      { name: instance, type: "SRV", data: { target: "salon.local", port: 8009 } },
      {
        name: instance,
        type: "TXT",
        data: [Buffer.from("fn=Télé du salon"), Buffer.from("id=abc")],
      },
      ...(withAddress ? [{ name: "salon.local", type: "A", data: "192.168.1.42" } as const] : []),
    ],
  };
}

test("reads a name out of the instance when the txt has none", () => {
  assert.equal(prettyInstance("Chromecast-Ultra-3f2a91bb77cc4410"), "Chromecast Ultra");
  assert.equal(prettyInstance("Salon_TV"), "Salon TV");
});

test("parses the txt entries, buffers or strings", () => {
  assert.deepEqual(parseTxt([Buffer.from("fn=Salon"), "id=x"]), { fn: "Salon", id: "x" });
  assert.deepEqual(parseTxt(undefined), { fn: null, id: null });
  assert.deepEqual(parseTxt(["broken"]), { fn: null, id: null });
});

test("builds a device from a full announcement", () => {
  const registry = createCastRegistry();
  const { changed } = registry.ingest(announcement(), "192.168.1.42");

  assert.equal(changed, true);
  assert.deepEqual(registry.list()[0], {
    id: instance.toLowerCase(),
    name: "Télé du salon",
    host: "192.168.1.42",
    port: 8009,
    lastSeen: registry.list()[0]?.lastSeen ?? 0,
    manual: false,
  });
});

test("asks for what is missing instead of giving up", () => {
  const registry = createCastRegistry();
  const { ask } = registry.ingest(announcement(false), "192.168.1.42");
  assert.ok(ask.some((question) => question.type === "A" && question.name === "salon.local"));
});

test("does not ask the same follow up twice in a row", () => {
  const clock = 1_000;
  const registry = createCastRegistry(() => clock);
  const first = registry.ingest(announcement(false), "192.168.1.42");
  const second = registry.ingest(announcement(false), "192.168.1.42");

  assert.ok(first.ask.length > 0);
  assert.equal(second.ask.length, 0, "a burst of packets must not become a burst of queries");
});

test("ignores a packet that says nothing about cast", () => {
  const registry = createCastRegistry();
  const result = registry.ingest({
    answers: [{ name: "_printer._tcp.local", type: "PTR", data: "hp._printer._tcp.local" }],
  });
  assert.deepEqual(result, { changed: false, matched: false, ask: [] });
  assert.equal(registry.list().length, 0);
});

test("forgets a device that stopped answering, but never the one in use", () => {
  let clock = 1_000;
  const registry = createCastRegistry(() => clock);
  registry.ingest(announcement(), "192.168.1.42");
  const id = registry.list()[0]?.id ?? "";

  clock += 61_000;
  assert.equal(registry.reap(id), false, "the device being cast to stays");
  assert.equal(registry.list().length, 1);
  assert.equal(registry.reap(null), true);
  assert.equal(registry.list().length, 0);
});

test("keeps a device added by hand through discovery restarts", () => {
  const registry = createCastRegistry();
  registry.ingest(announcement(), "192.168.1.42");
  registry.addManual("192.168.1.50");

  registry.clear(null);
  assert.deepEqual(
    registry.list().map((device) => device.host),
    ["192.168.1.50"],
  );
});
