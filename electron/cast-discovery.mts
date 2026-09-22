import dgram from "node:dgram";
import dnsPacket from "dns-packet";
import makeMdns from "multicast-dns";
import {
  CAST_SERVICE,
  createCastRegistry,
  type CastRegistry,
  type Device,
  type Packet,
  type Question,
} from "./cast-registry.mts";
import { lanInterfaces, type Interface } from "./lan-address.mts";
import { createLogger } from "./log.mts";

export type QuerySocket = {
  on(event: "message", listener: (message: Buffer, from: { address: string }) => void): void;
  on(event: "error", listener: (error: NodeJS.ErrnoException) => void): void;
  bind(port: number, address: string, ready: () => void): void;
  setMulticastInterface(address: string): void;
  setMulticastTTL(ttl: number): void;
  send(message: Buffer, port: number, address: string, sent: () => void): void;
  close(): void;
};

export type MdnsListener = {
  on(event: "response", listener: (packet: Packet, from: { address: string }) => void): void;
  on(event: "error", listener: (error: NodeJS.ErrnoException) => void): void;
  query(query: { questions: Question[] }): void;
  destroy(): void;
};

export type Sockets = {
  interfaces: () => Interface[];
  createSocket: () => QuerySocket;
  createListener: () => MdnsListener;
};

export type CardDiagnostic = { name: string; address: string; error: string | null };

export type Diagnostics = {
  discovering: boolean;
  devices: number;
  listenerError: string | null;
  cards: CardDiagnostic[];
  packets: number;
  castAnswers: number;
  dropped: number;
};

export type DiscoveryParts = {
  onDevices: (devices: Device[]) => void;
  busyId?: () => string | null;
  registry?: CastRegistry;
  sockets?: Sockets;
};

const log = createLogger("cast-discovery");

const MDNS_GROUP = "224.0.0.251";
const MDNS_PORT = 5353;
const REQUERY_MS = 10_000;
const WARMUP_MS = [1_000, 3_000];
// With no new call to start (the cast menu is closed) and nothing playing, stop listening.
const IDLE_MS = 3 * 60_000;

const nodeSockets: Sockets = {
  interfaces: lanInterfaces,
  createSocket: () => dgram.createSocket({ type: "udp4", reuseAddr: true }),
  createListener: () => makeMdns(),
};

export function createDiscovery(parts: DiscoveryParts) {
  const { onDevices } = parts;
  const busyId = parts.busyId ?? (() => null);
  const registry = parts.registry ?? createCastRegistry();
  const sockets = parts.sockets ?? nodeSockets;

  let discovering = false;
  let listener: MdnsListener | null = null;
  let cards: { socket: QuerySocket; ready: boolean }[] = [];
  let requery: NodeJS.Timeout | null = null;
  let idle: NodeJS.Timeout | null = null;
  let warmup: NodeJS.Timeout[] = [];
  const counts = { listenerError: null as string | null, packets: 0, castAnswers: 0, dropped: 0 };
  let cardErrors: CardDiagnostic[] = [];

  function ask(questions: Question[]): void {
    if (questions.length === 0) return;
    const message = dnsPacket.encode({ type: "query", id: 0, questions });
    for (const card of cards) {
      if (card.ready) card.socket.send(message, MDNS_PORT, MDNS_GROUP, () => {});
    }
    if (!listener) return;
    try {
      listener.query({ questions });
    } catch (error) {
      // The shared socket is the second receiver, never the only one: the cards carry on.
      log.warn("the shared mdns socket refused a query", { err: error });
    }
  }

  const browse = () => ask([{ name: CAST_SERVICE, type: "PTR" }]);

  function ingest(packet: Packet, address: string): void {
    counts.packets += 1;
    const seen = registry.ingest(packet, address);
    if (seen.matched) counts.castAnswers += 1;
    ask(seen.ask);
    if (seen.changed) onDevices(registry.list());
  }

  function openCards(): void {
    cardErrors = [];
    for (const card of sockets.interfaces()) {
      const socket = sockets.createSocket();
      const entry = { socket, ready: false };
      cards.push(entry);

      socket.on("message", (message, from) => {
        try {
          ingest(dnsPacket.decode(message), from.address);
        } catch {
          counts.dropped += 1;
        }
      });
      socket.on("error", (error) => {
        cardErrors.push({ ...describe(card), error: error.code ?? error.message });
      });
      socket.bind(0, card.address, () => {
        entry.ready = true;
        cardErrors.push({ ...describe(card), error: chooseCard(socket, card.address) });
        browse();
      });
    }
  }

  function chooseCard(socket: QuerySocket, address: string): string | null {
    try {
      socket.setMulticastInterface(address);
      socket.setMulticastTTL(255);
      return null;
    } catch (error) {
      // Some adapters refuse to be picked; the socket still sends on the default route.
      return (error as NodeJS.ErrnoException).code ?? String(error);
    }
  }

  function armIdle(): void {
    if (idle) clearTimeout(idle);
    idle = setTimeout(() => {
      // Nothing calls start again while a cast runs, so the check has to re-arm itself.
      if (busyId()) armIdle();
      else stop();
    }, IDLE_MS);
  }

  function start(): Device[] {
    armIdle();
    if (discovering) {
      browse();
      return registry.list();
    }

    discovering = true;
    counts.listenerError = null;
    counts.packets = 0;
    counts.castAnswers = 0;
    counts.dropped = 0;

    listener = sockets.createListener();
    listener.on("response", (packet, from) => ingest(packet, from.address));
    listener.on("error", (error) => {
      // Port 5353 can be held exclusively (Bonjour): the per card sockets are enough.
      counts.listenerError = error.code ?? error.message;
      log.warn("mdns on 5353 unavailable", { err: error });
    });

    openCards();
    // A multicast packet is easily lost, so the first browses are repeated.
    warmup = WARMUP_MS.map((ms) => setTimeout(browse, ms));
    requery = setInterval(() => {
      browse();
      if (registry.reap(busyId())) onDevices(registry.list());
    }, REQUERY_MS);

    log.info("discovering", { cards: cards.length });
    return registry.list();
  }

  function stop(): void {
    if (!discovering) return;
    discovering = false;

    if (requery) clearInterval(requery);
    if (idle) clearTimeout(idle);
    warmup.forEach(clearTimeout);
    requery = null;
    idle = null;
    warmup = [];

    for (const card of cards) {
      try {
        card.socket.close();
      } catch (error) {
        // A socket whose bind never landed is already not running.
        log.debug("socket refused to close", { err: error });
      }
    }
    cards = [];
    listener?.destroy();
    listener = null;

    registry.clear(busyId());
    onDevices(registry.list());
    log.info("stopped");
  }

  function addManual(ip: string): Device {
    const device = registry.addManual(ip);
    onDevices(registry.list());
    return device;
  }

  return {
    start,
    stop,
    addManual,
    devices: () => registry.list(),
    diagnostics: (): Diagnostics => ({
      discovering,
      devices: registry.list().length,
      listenerError: counts.listenerError,
      cards: cardErrors,
      packets: counts.packets,
      castAnswers: counts.castAnswers,
      dropped: counts.dropped,
    }),
  };
}

function describe(card: Interface): { name: string; address: string } {
  return { name: card.name, address: card.address };
}

export type Discovery = ReturnType<typeof createDiscovery>;
