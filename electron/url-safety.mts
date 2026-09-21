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
  /^::1$/,
  /^fc/i,
  /^fd/i,
  /^fe80:/i,
];

export type Lookup = (hostname: string) => Promise<string[]>;
export type Check = { valid: true } | { valid: false; error: string };

export function isPrivateAddress(address: string): boolean {
  if (!address) return true;
  return PRIVATE_RANGES.some((range) => range.test(address));
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

  const hostname = parsed.hostname;
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
