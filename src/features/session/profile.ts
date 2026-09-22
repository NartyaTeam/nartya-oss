import type { SupabaseClient } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  username: string | null;
  avatar: string | null;
  lastLogin: string | null;
};

// The account is gone when the server says so, unknown when the network does not answer:
// a local token stays cryptographically valid for about an hour, so the difference matters.
export type UserCheck = "valid" | "gone" | "unknown";

export type ProfileSource = {
  fetch: (userId: string) => Promise<{ row: unknown; failed: boolean }>;
  confirmUser: () => Promise<UserCheck>;
  touch: (userId: string, at: string) => Promise<void>;
};

export type Loaded = { profile: Profile | null; signOut: boolean };

const LAST_LOGIN_EVERY_MS = 60 * 60_000;

export function parseProfile(row: unknown): Profile | null {
  if (typeof row !== "object" || row === null) return null;
  const record = row as Record<string, unknown>;
  if (typeof record["id"] !== "string") return null;

  return {
    id: record["id"],
    username: typeof record["username"] === "string" ? record["username"] : null,
    avatar: typeof record["avatar"] === "string" ? record["avatar"] : null,
    lastLogin: typeof record["last_login"] === "string" ? record["last_login"] : null,
  };
}

// Written on every session hydration, this column cost 109 685 updates in 38 days for a
// thousand accounts. An hour is as precise as "last seen" ever needs to be.
export function shouldTouchLastLogin(lastLogin: string | null, now: number): boolean {
  if (!lastLogin) return true;
  const previous = Date.parse(lastLogin);
  return Number.isNaN(previous) || now - previous > LAST_LOGIN_EVERY_MS;
}

export async function loadProfile(
  source: ProfileSource,
  userId: string,
  now: number = Date.now(),
): Promise<Loaded> {
  const { row, failed } = await source.fetch(userId);
  if (failed) return { profile: null, signOut: false };

  const profile = parseProfile(row);
  if (!profile) {
    // No row can mean a request that went out before the client was authenticated, or an
    // account deleted on the server. Only the server can tell those apart.
    const check = await source.confirmUser();
    return { profile: null, signOut: check === "gone" };
  }

  if (shouldTouchLastLogin(profile.lastLogin, now)) {
    await source.touch(userId, new Date(now).toISOString());
  }
  return { profile, signOut: false };
}

export function supabaseProfiles(client: SupabaseClient): ProfileSource {
  return {
    fetch: async (userId) => {
      const { data, error } = await client
        .from("profiles")
        .select("id, username, avatar, last_login")
        .eq("id", userId)
        .maybeSingle();
      return { row: data, failed: error !== null };
    },

    confirmUser: async () => {
      try {
        const { data, error } = await client.auth.getUser();
        if (error) return error.status === 401 || error.status === 403 ? "gone" : "unknown";
        return data.user ? "valid" : "gone";
      } catch {
        return "unknown";
      }
    },

    touch: async (userId, at) => {
      await client.from("profiles").update({ last_login: at }).eq("id", userId);
    },
  };
}
