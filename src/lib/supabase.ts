import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Config } from "./config.ts";

export function createSupabaseClient(config: Config): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      // The packaged app is served from file://, where there is no callback URL to read.
      detectSessionInUrl: false,
    },
  });
}
