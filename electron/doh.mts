import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { DOH_ENDPOINTS } from "./endpoints.mts";

export type Family = 0 | 4 | 6;
export type DnsRecord = { address: string; family: 4 | 6 };
export type Query = (hostname: string, type: "A" | "AAAA") => Promise<string[]>;

const CACHE_TTL_MS = 5 * 60_000;
const QUERY_TIMEOUT_MS = 5_000;

async function dohQuery(hostname: string, type: "A" | "AAAA"): Promise<string[]> {
  const wanted = type === "AAAA" ? 6 : 4;
  for (const endpoint of DOH_ENDPOINTS) {
    try {
      const response = await fetch(
        `${endpoint}?name=${encodeURIComponent(hostname)}&type=${type}`,
        {
          headers: { accept: "application/dns-json" },
          signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
        },
      );
      if (!response.ok) continue;
      const body: unknown = await response.json().catch(() => null);
      const answers = readAnswers(body, type === "AAAA" ? 28 : 1);
      const addresses = answers.filter((address) => isIP(address) === wanted);
      if (addresses.length > 0) return addresses;
    } catch {
      // Try the next endpoint.
    }
  }
  return [];
}

function readAnswers(body: unknown, recordType: number): string[] {
  if (typeof body !== "object" || body === null) return [];
  const answer = (body as { Answer?: unknown }).Answer;
  if (!Array.isArray(answer)) return [];
  return answer
    .filter((entry): entry is { type: number; data: string } => {
      if (typeof entry !== "object" || entry === null) return false;
      const { type, data } = entry as { type?: unknown; data?: unknown };
      return type === recordType && typeof data === "string";
    })
    .map((entry) => entry.data);
}

export function createResolver(query: Query, ttlMs: number = CACHE_TTL_MS) {
  const cache = new Map<string, { records: DnsRecord[]; expires: number }>();
  const inflight = new Map<string, Promise<DnsRecord[]>>();

  async function lookUp(hostname: string, family: Family): Promise<DnsRecord[]> {
    if (family === 6) {
      return (await query(hostname, "AAAA")).map((address) => ({ address, family: 6 }) as const);
    }
    const v4 = (await query(hostname, "A")).map((address) => ({ address, family: 4 }) as const);
    if (v4.length > 0 || family === 4) return v4;
    return (await query(hostname, "AAAA")).map((address) => ({ address, family: 6 }) as const);
  }

  return function resolve(hostname: string, family: Family = 0): Promise<DnsRecord[]> {
    const key = `${hostname}|${family}`;
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.records);

    const pending = inflight.get(key);
    if (pending) return pending;

    const request = lookUp(hostname, family)
      .then((records) => {
        if (records.length > 0) cache.set(key, { records, expires: Date.now() + ttlMs });
        return records;
      })
      .finally(() => inflight.delete(key));

    inflight.set(key, request);
    return request;
  };
}

export const resolveHost = createResolver(dohQuery);

export async function dohAddresses(hostname: string): Promise<string[]> {
  const records = await resolveHost(hostname);
  return records.map((record) => record.address);
}

// Wider than DnsRecord on purpose: the system fallback reports family as a plain number.
type LookupRecord = { address: string; family: number };
type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupRecord[],
  family?: number,
) => void;

function systemLookup(hostname: string, settings: dns.LookupOptions, done: LookupCallback): void {
  if (settings.all === true) {
    dns.lookup(hostname, { ...settings, all: true }, (error, addresses) => done(error, addresses));
  } else {
    dns.lookup(hostname, { ...settings, all: false }, (error, address, family) =>
      done(error, address, family),
    );
  }
}

export function dohLookup(
  hostname: string,
  options: dns.LookupOptions | LookupCallback,
  callback?: LookupCallback,
): void {
  const done = (typeof options === "function" ? options : callback) as LookupCallback;
  const settings = typeof options === "function" ? {} : options;

  const literal = isIP(hostname);
  if (literal === 4 || literal === 6) {
    if (settings.all) done(null, [{ address: hostname, family: literal }]);
    else done(null, hostname, literal);
    return;
  }

  const family = (settings.family ?? 0) as Family;
  resolveHost(hostname, family)
    .then((records) => {
      const first = records[0];
      // A silent resolver is not a reason to fail: fall back to the system one.
      if (!first) return systemLookup(hostname, settings, done);
      if (settings.all) done(null, records);
      else done(null, first.address, first.family);
      return;
    })
    .catch(() => systemLookup(hostname, settings, done));
}

// createConnection is the reliable place to inject the resolver: passing lookup to the
// Agent constructor does not reach net.connect.
export function createDohHttpsAgent(options: https.AgentOptions = {}): https.Agent {
  return new (class extends https.Agent {
    override createConnection(connection: object, connected: () => void) {
      return super.createConnection({ ...connection, lookup: dohLookup }, connected);
    }
  })(options);
}

export function createDohHttpAgent(options: http.AgentOptions = {}): http.Agent {
  return new (class extends http.Agent {
    override createConnection(connection: object, connected: () => void) {
      return super.createConnection({ ...connection, lookup: dohLookup }, connected);
    }
  })(options);
}
