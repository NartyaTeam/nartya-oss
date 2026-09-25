import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Config } from "./config.ts";

export const SESSION_STORAGE_KEY = "nartya-auth";

export function createSupabaseClient(config: Config): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      // Known, so the session can be read before the client is up: it waits on the network.
      storageKey: SESSION_STORAGE_KEY,
      autoRefreshToken: true,
      // The packaged app is served from file://, where there is no callback URL to read.
      detectSessionInUrl: false,
    },
  });
}
