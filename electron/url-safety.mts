import { isIP } from "node:net";
import { resolve, sep } from "node:path";

const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  // Multicast, reserved and broadcast: no host to fetch from lives there.
  /^2(2[4-9]|[3-5]\d)\./,
  /^::1?$/,
  /^fc/i,
  /^fd/i,
  /^fe80:/i,
];

export type Lookup = (hostname: string) => Promise<string[]>;
export type Check = { valid: true } | { valid: false; error: string };

// An ipv4 address can come back from a resolver written as ipv6, dotted or in hex.
function unmapped(address: string): string {
  const mapped = /^::ffff:(.+)$/i.exec(address)?.[1];
  if (!mapped || mapped.includes(".")) return mapped ?? address;
  const [high, low] = mapped.split(":").map((part) => Number.parseInt(part, 16));
  if (high === undefined || low === undefined || Number.isNaN(high) || Number.isNaN(low)) {
    return address;
  }
  return [high >> 8, high & 255, low >> 8, low & 255].join(".");
}

export function isPrivateAddress(address: string): boolean {
  if (!address) return true;
  const plain = unmapped(address);
  return PRIVATE_RANGES.some((range) => range.test(plain));
}

// The caller passes the resolver it will fetch with: where DNS is poisoned, another
// resolver sees another address and the check stops meaning anything.
export async function validateExternalUrl(value: string, lookup: Lookup): Promise<Check> {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { valid: false, error: "URL invalide" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Protocole non autorisé" };
  }

  // An ipv6 literal keeps its brackets in a URL, where isIP does not recognise it.
  const hostname = parsed.hostname.replace(/^\[(.*)\]$/, "$1");
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) return { valid: false, error: "IP privée ou réservée" };
    return { valid: true };
  }

  let addresses: string[];
  try {
    addresses = await lookup(hostname);
  } catch {
    return { valid: false, error: "Hôte introuvable" };
  }
  if (addresses.length === 0) return { valid: false, error: "Hôte introuvable" };

  const blocked = addresses.find(isPrivateAddress);
  if (blocked !== undefined) {
    return { valid: false, error: `${hostname} résout vers une adresse privée` };
  }
  return { valid: true };
}

// Compared with a trailing separator so that base2/ does not pass for base/.
export function isPathInside(candidate: string, baseDir: string): boolean {
  const target = resolve(candidate);
  const base = resolve(baseDir);
  return target === base || target.startsWith(base + sep);
}
