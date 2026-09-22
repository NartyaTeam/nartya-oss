import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import dnsPacket from "dns-packet";
import {
  createDiscovery,
  type MdnsListener,
  type QuerySocket,
  type Sockets,
} from "./cast-discovery.mts";
import { CAST_SERVICE, type Device, type Packet, type Question } from "./cast-registry.mts";
import type { Interface } from "./lan-address.mts";

function at<T>(items: T[], index: number): T {
  const item = items[index];
  assert.ok(item, `nothing at ${index}`);
  return item;
}

const instance = `Chromecast-Ultra-3f2a91bb77cc4410.${CAST_SERVICE}`;

const card = (name: string, address: string): Interface => ({
  name,
  address,
  netmask: "255.255.255.0",
  virtual: false,
});

function announcement(): Packet {
  return {
    answers: [
      { name: CAST_SERVICE, type: "PTR", data: instance },
      { name: instance, type: "SRV", data: { target: "salon.local", port: 8009 } },
      { name: instance, type: "TXT", data: [Buffer.from("fn=Salon")] },
      { name: "salon.local", type: "A", data: "192.168.1.42" },
    ],
  };
}

type MessageListener = (message: Buffer, from: { address: string }) => void;
type ResponseListener = (packet: Packet, from: { address: string }) => void;
type ErrorListener = (error: NodeJS.ErrnoException) => void;

class FakeSocket implements QuerySocket {
  bound: string | null = null;
  closed = 0;
  chosen: string | null = null;
  ttl: number | null = null;
  sent: Question[][] = [];
  chooseError: NodeJS.ErrnoException | null = null;
  private onMessage: MessageListener | null = null;
  private onError: ErrorListener | null = null;

  on(event: "message", listener: MessageListener): void;
  on(event: "error", listener: ErrorListener): void;
  on(event: "message" | "error", listener: MessageListener & ErrorListener): void {
    if (event === "message") this.onMessage = listener;
    else this.onError = listener;
  }

  bind(_port: number, address: string, ready: () => void): void {
    this.bound = address;
    ready();
  }

  setMulticastInterface(address: string): void {
    if (this.chooseError) throw this.chooseError;
    this.chosen = address;
  }

  setMulticastTTL(ttl: number): void {
    this.ttl = ttl;
  }

  send(message: Buffer, port: number, address: string, sent: () => void): void {
    assert.equal(port, 5353);
    assert.equal(address, "224.0.0.251");
    const asked = dnsPacket.decode(message).questions ?? [];
    this.sent.push(asked.map(({ name, type }) => ({ name, type }) as Question));
    sent();
  }

  close(): void {
    this.closed += 1;
  }

  receive(packet: Packet, from = "192.168.1.42"): void {
    this.onMessage?.(dnsPacket.encode(packet as dnsPacket.Packet), { address: from });
  }

  receiveRaw(message: Buffer): void {
    this.onMessage?.(message, { address: "192.168.1.42" });
  }

  fail(error: NodeJS.ErrnoException): void {
    this.onError?.(error);
  }
}

class FakeListener implements MdnsListener {
  queries: Question[][] = [];
  destroyed = 0;
  queryError: Error | null = null;
  private onResponse: ResponseListener | null = null;
  private onError: ErrorListener | null = null;

  on(event: "response", listener: ResponseListener): void;
  on(event: "error", listener: ErrorListener): void;
  on(event: "response" | "error", listener: ResponseListener & ErrorListener): void {
    if (event === "response") this.onResponse = listener;
    else this.onError = listener;
  }

  query(query: { questions: Question[] }): void {
    if (this.queryError) throw this.queryError;
    this.queries.push(query.questions);
  }

  destroy(): void {
    this.destroyed += 1;
  }

  respond(packet: Packet, from = "192.168.1.42"): void {
    this.onResponse?.(packet, { address: from });
  }

  fail(error: NodeJS.ErrnoException): void {
    this.onError?.(error);
  }
}

function setup(cards = [card("Wi-Fi", "192.168.1.10")]) {
  const opened: FakeSocket[] = [];
  const listener = new FakeListener();
  const seen: Device[][] = [];
  const sockets: Sockets = {
    interfaces: () => cards,
    createSocket: () => {
      const socket = new FakeSocket();
      opened.push(socket);
      return socket;
    },
    createListener: () => listener,
  };
  const discovery = createDiscovery({ onDevices: (devices) => seen.push(devices), sockets });
  return { discovery, opened, listener, seen };
}

test("opens one socket per card and browses on each", (t: TestContext) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const cards = [card("Wi-Fi", "192.168.1.10"), card("Ethernet", "10.0.0.5")];
  const { discovery, opened, listener } = setup(cards);

  discovery.start();
  assert.equal(opened.length, 2);
  assert.deepEqual(
    opened.map((socket) => socket.bound),
    ["192.168.1.10", "10.0.0.5"],
  );
  assert.deepEqual(
    opened.map((socket) => socket.chosen),
    ["192.168.1.10", "10.0.0.5"],
  );
  assert.deepEqual(at(opened, 0).sent[0], [{ name: CAST_SERVICE, type: "PTR" }]);
  assert.deepEqual(listener.queries[0], [{ name: CAST_SERVICE, type: "PTR" }]);

  discovery.stop();
});

test("a card that refuses to be picked is reported and still browses", (t: TestContext) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const opened: FakeSocket[] = [];
  const sockets: Sockets = {
    interfaces: () => [card("vEthernet", "172.20.0.1")],
    createSocket: () => {
      const socket = new FakeSocket();
      socket.chooseError = Object.assign(new Error("invalid argument"), { code: "EINVAL" });
      opened.push(socket);
      return socket;
    },
    createListener: () => new FakeListener(),
  };
  const discovery = createDiscovery({ onDevices: () => {}, sockets });

  discovery.start();
  assert.equal(at(opened, 0).sent.length, 1);
  assert.deepEqual(discovery.diagnostics().cards, [
    { name: "vEthernet", address: "172.20.0.1", error: "EINVAL" },
  ]);

  discovery.stop();
});

test("a ptr on its own resolves through the packet source, then the txt names it", (t: TestContext) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const { discovery, opened, seen } = setup();
  discovery.start();

  at(opened, 0).receive({ answers: [{ name: CAST_SERVICE, type: "PTR", data: instance }] });
  assert.deepEqual(
    at(seen, 0).map((device) => [device.name, device.host]),
    [["Chromecast Ultra", "192.168.1.42"]],
  );
  assert.deepEqual(at(opened, 0).sent[1], [
    { name: instance, type: "SRV" },
    { name: instance, type: "TXT" },
  ]);

  t.mock.timers.tick(3_000);
  at(opened, 0).receive(announcement());
  assert.deepEqual(
    seen.at(-1)?.map((device) => [device.name, device.host]),
    [["Salon", "192.168.1.42"]],
  );
  assert.equal(discovery.diagnostics().castAnswers, 2);

  discovery.stop();
});

test("the shared listener is a second receiver, and its failure is only recorded", (t: TestContext) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const { discovery, opened, listener, seen } = setup();
  discovery.start();

  listener.fail(Object.assign(new Error("address in use"), { code: "EADDRINUSE" }));
  listener.queryError = new Error("socket closed");
  assert.equal(discovery.diagnostics().listenerError, "EADDRINUSE");

  listener.respond(announcement());
  assert.equal(seen.length, 1);
  assert.ok(at(opened, 0).sent.length >= 1);

  discovery.stop();
});

test("a packet that cannot be decoded is counted, not thrown", (t: TestContext) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const { discovery, opened } = setup();
  discovery.start();

  at(opened, 0).receiveRaw(Buffer.from([0x00, 0x01, 0x02]));
  assert.equal(discovery.diagnostics().dropped, 1);
  assert.equal(discovery.diagnostics().packets, 0);

  discovery.stop();
});

test("starting again only browses, it does not open a second set of sockets", (t: TestContext) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const { discovery, opened } = setup();
  discovery.start();
  const sentOnce = at(opened, 0).sent.length;

  discovery.start();
  assert.equal(opened.length, 1);
  assert.equal(at(opened, 0).sent.length, sentOnce + 1);

  discovery.stop();
});

test("stops on its own when idle, unless something is casting", (t: TestContext) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  let busy: string | null = "manual:192.168.1.42";
  const opened: FakeSocket[] = [];
  const listener = new FakeListener();
  const sockets: Sockets = {
    interfaces: () => [card("Wi-Fi", "192.168.1.10")],
    createSocket: () => {
      const socket = new FakeSocket();
      opened.push(socket);
      return socket;
    },
    createListener: () => listener,
  };
  const discovery = createDiscovery({ onDevices: () => {}, sockets, busyId: () => busy });

  discovery.start();
  t.mock.timers.tick(4 * 60_000);
  assert.equal(discovery.diagnostics().discovering, true);
  // Nothing calls start again while a cast runs, so the idle check has to come back.
  t.mock.timers.tick(4 * 60_000);
  assert.equal(discovery.diagnostics().discovering, true);

  busy = null;
  t.mock.timers.tick(4 * 60_000);
  assert.equal(discovery.diagnostics().discovering, false);
  assert.equal(at(opened, 0).closed, 1);
  assert.equal(listener.destroyed, 1);
});

test("drops devices nobody has answered for, keeping the one being cast to", (t: TestContext) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const { discovery, opened, seen } = setup();
  discovery.start();

  at(opened, 0).receive(announcement());
  const manual = discovery.addManual("192.168.1.99");
  assert.equal(discovery.devices().length, 2);

  t.mock.timers.tick(70_000);
  assert.deepEqual(
    discovery.devices().map((device) => device.id),
    [manual.id],
  );
  assert.ok(seen.length >= 3);

  discovery.stop();
});

test("stop closes the sockets, drops the listener and clears the devices", (t: TestContext) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const { discovery, opened, listener, seen } = setup();
  discovery.start();
  at(opened, 0).receive(announcement());

  discovery.stop();
  assert.equal(at(opened, 0).closed, 1);
  assert.equal(listener.destroyed, 1);
  assert.deepEqual(discovery.devices(), []);
  assert.deepEqual(seen.at(-1), []);
  assert.equal(discovery.diagnostics().discovering, false);

  discovery.stop();
  assert.equal(at(opened, 0).closed, 1);
});
