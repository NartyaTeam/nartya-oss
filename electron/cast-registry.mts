import { isPrivateIpv4, isVirtualNetworkAddress } from "./lan-address.mts";

export const CAST_SERVICE = "_googlecast._tcp.local";
export const DEFAULT_CAST_PORT = 8009;

const DEVICE_TTL_MS = 60_000;
const FOLLOW_UP_GAP_MS = 2_000;

export type Question = { name: string; type: "PTR" | "SRV" | "TXT" | "A" };

export type Device = {
  id: string;
  name: string;
  host: string;
  port: number;
  lastSeen: number;
  manual: boolean;
};

export type Record_ = { name: string; type: string; data?: unknown };
export type Ingested = { changed: boolean; matched: boolean; ask: Question[] };
export type Packet = { answers?: Record_[]; additionals?: Record_[]; authorities?: Record_[] };

type Instance = { name: string; lastSeen: number; source: string | null };
type Srv = { target: string; port: number };
type Txt = { id: string | null; fn: string | null };

const lower = (value: unknown) => String(value ?? "").toLowerCase();
const isCastName = (name: unknown) => lower(name).endsWith(`.${CAST_SERVICE}`);

// "Chromecast-Ultra-3f2a...c91" reads as "Chromecast Ultra" when the TXT fn is missing.
export function prettyInstance(instance: string): string {
  return instance
    .replace(/-[0-9a-f]{16,}$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

export function parseTxt(data: unknown): Txt {
  const out: Record<string, string> = {};
  for (const entry of Array.isArray(data) ? data : [data]) {
    const text = Buffer.isBuffer(entry) ? entry.toString() : String(entry ?? "");
    const equals = text.indexOf("=");
    if (equals > 0) out[text.slice(0, equals)] = text.slice(equals + 1);
  }
  return { id: out.id ?? null, fn: out.fn ?? null };
}

export function createCastRegistry(now: () => number = Date.now) {
  const instances = new Map<string, Instance>();
  const srv = new Map<string, Srv>();
  const txt = new Map<string, Txt>();
  const addresses = new Map<string, string>();
  const lastFollowUp = new Map<string, number>();
  const devices = new Map<string, Device>();

  function followUp(key: string): Question[] {
    const asked = lastFollowUp.get(key);
    // Never asked is not the same as asked at time zero.
    if (asked !== undefined && now() - asked < FOLLOW_UP_GAP_MS) return [];
    lastFollowUp.set(key, now());
    const name = instances.get(key)?.name ?? key;
    const questions: Question[] = [
      { name, type: "SRV" },
      { name, type: "TXT" },
    ];
    const target = srv.get(key)?.target;
    if (target) questions.push({ name: target, type: "A" });
    return questions;
  }

  function resolve(key: string): { changed: boolean; ask: Question[] } {
    const instance = instances.get(key);
    if (!instance) return { changed: false, ask: [] };

    const service = srv.get(key);
    const text = txt.get(key);
    const host = (service && addresses.get(service.target)) || instance.source;

    const ask = !service || !text || !addresses.get(service.target) ? followUp(key) : [];
    if (!host) return { changed: false, ask };

    const previous = devices.get(key);
    const label = instance.name.slice(0, -(CAST_SERVICE.length + 1));
    const device: Device = {
      id: key,
      name: text?.fn || prettyInstance(label) || host,
      host,
      port: service?.port ?? DEFAULT_CAST_PORT,
      lastSeen: instance.lastSeen,
      manual: false,
    };
    devices.set(key, device);

    const changed =
      !previous ||
      previous.name !== device.name ||
      previous.host !== device.host ||
      previous.port !== device.port;
    return { changed, ask };
  }

  function ingest(packet: Packet, sourceAddress?: string): Ingested {
    const all = [
      ...(packet.answers ?? []),
      ...(packet.additionals ?? []),
      ...(packet.authorities ?? []),
    ];
    const touched = new Set<string>();
    const source = sourceAddress && isPrivateIpv4(sourceAddress) ? sourceAddress : null;
    let addressesChanged = false;

    for (const record of all) {
      const name = lower(record.name);
      if (record.type === "PTR" && name === CAST_SERVICE && isCastName(record.data)) {
        const key = lower(record.data);
        touched.add(key);
        instances.set(key, {
          ...(instances.get(key) ?? { lastSeen: 0, source: null }),
          name: String(record.data),
        });
      } else if (record.type === "SRV" && isCastName(name)) {
        const data = record.data as { target?: string; port?: number };
        srv.set(name, { target: lower(data?.target), port: data?.port || DEFAULT_CAST_PORT });
        touched.add(name);
      } else if (record.type === "TXT" && isCastName(name)) {
        txt.set(name, parseTxt(record.data));
        touched.add(name);
      } else if (record.type === "A" && typeof record.data === "string") {
        if (addresses.get(name) !== record.data) {
          addresses.set(name, record.data);
          addressesChanged = true;
        }
      }
    }
    if (touched.size === 0 && !addressesChanged) return { changed: false, matched: false, ask: [] };

    for (const key of touched) {
      const known = instances.get(key);
      // An address seen on a real card wins over one seen on a virtual adapter.
      const keepKnown = known?.source && (!source || isVirtualNetworkAddress(source));
      instances.set(key, {
        name: known?.name ?? key,
        lastSeen: now(),
        source: keepKnown ? known.source : (source ?? known?.source ?? null),
      });
    }

    let changed = false;
    const ask: Question[] = [];
    for (const key of instances.keys()) {
      const result = resolve(key);
      changed = result.changed || changed;
      ask.push(...result.ask);
    }
    return { changed, matched: touched.size > 0, ask };
  }

  function reap(busyId: string | null = null): boolean {
    let changed = false;
    for (const [key, device] of devices) {
      if (device.manual || busyId === key) continue;
      if (now() - device.lastSeen > DEVICE_TTL_MS) {
        devices.delete(key);
        instances.delete(key);
        changed = true;
      }
    }
    return changed;
  }

  function addManual(ip: string): Device {
    const key = `manual:${ip}`;
    const device: Device = {
      id: key,
      name: `Appareil ${ip}`,
      host: ip,
      port: DEFAULT_CAST_PORT,
      lastSeen: now(),
      manual: true,
    };
    devices.set(key, device);
    return device;
  }

  function clear(busyId: string | null = null): void {
    for (const [key, device] of devices) {
      if (!device.manual && busyId !== key) devices.delete(key);
    }
    instances.clear();
    srv.clear();
    txt.clear();
    addresses.clear();
    lastFollowUp.clear();
  }

  return { ingest, reap, addManual, clear, list: () => [...devices.values()] };
}

export type CastRegistry = ReturnType<typeof createCastRegistry>;
