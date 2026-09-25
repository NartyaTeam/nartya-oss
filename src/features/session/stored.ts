import type { Session } from "@supabase/supabase-js";
import { SESSION_STORAGE_KEY } from "../../lib/supabase.ts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function parseStoredSession(raw: string | null): Session | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !isRecord(parsed.user)) return null;
  if (typeof parsed.access_token !== "string" || typeof parsed.refresh_token !== "string") {
    return null;
  }
  if (typeof parsed.user.id !== "string") return null;
  // Written by auth-js itself; only the fields this app relies on are checked.
  return parsed as unknown as Session;
}

export function readStoredSession(): Session | null {
  try {
    return parseStoredSession(globalThis.localStorage.getItem(SESSION_STORAGE_KEY));
  } catch {
    // Storage blocked: the client will answer on its own, only later.
    return null;
  }
}
