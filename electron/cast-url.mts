import crypto from "node:crypto";
import { localAddressFor } from "./lan-address.mts";

export type CastTarget = {
  port: number;
  token: string;
  castPort: number;
  castToken: string;
  deviceIp: string;
};

const ROUTES = new Set(["/video/proxy", "/local"]);
const LOOPBACK = new Set(["127.0.0.1", "localhost"]);

// Only what came out of our own loopback proxy is translated, never an arbitrary url, and
// the caller has to already hold the loopback token to be handed the lan one.
export function toCastUrl(localUrl: string, target: CastTarget): string | null {
  let url: URL;
  try {
    url = new URL(localUrl);
  } catch {
    return null;
  }

  if (url.port !== String(target.port)) return null;
  if (!LOOPBACK.has(url.hostname)) return null;
  if (!ROUTES.has(url.pathname)) return null;
  if (!sameToken(url.searchParams.get("t"), target.token)) return null;

  url.hostname = localAddressFor(target.deviceIp);
  url.port = String(target.castPort);
  url.searchParams.set("t", target.castToken);
  return url.toString();
}

function sameToken(given: string | null, expected: string): boolean {
  if (given === null) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
