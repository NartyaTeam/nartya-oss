export type Config = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiBase: string | null;
  captchaSiteKey: string | null;
  discordClientId: string | null;
  siteUrl: string | null;
};

export type ConfigResult = { ok: true; config: Config } | { ok: false; missing: string[] };

type Env = {
  VITE_SUPABASE_URL?: string | undefined;
  VITE_SUPABASE_ANON_KEY?: string | undefined;
  VITE_API_BASE?: string | undefined;
  VITE_TURNSTILE_SITE_KEY?: string | undefined;
  VITE_DISCORD_RPC_CLIENT_ID?: string | undefined;
  VITE_SITE_URL?: string | undefined;
};

export function parseConfig(env: Env): ConfigResult {
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

  const missing: string[] = [];
  if (!url) missing.push("VITE_SUPABASE_URL");
  if (!anonKey) missing.push("VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) return { ok: false, missing };

  const apiBase = env.VITE_API_BASE?.trim();
  const captchaSiteKey = env.VITE_TURNSTILE_SITE_KEY?.trim();
  const discordClientId = env.VITE_DISCORD_RPC_CLIENT_ID?.trim();
  const siteUrl = env.VITE_SITE_URL?.trim();
  return {
    ok: true,
    config: {
      supabaseUrl: url,
      supabaseAnonKey: anonKey,
      apiBase: apiBase ? apiBase.replace(/\/+$/, "") : null,
      // Optional: only a project with bot protection turned on refuses calls without it.
      captchaSiteKey: captchaSiteKey || null,
      discordClientId: discordClientId && /^\d+$/.test(discordClientId) ? discordClientId : null,
      // Discord only takes https buttons.
      siteUrl: siteUrl?.startsWith("https://") ? siteUrl.replace(/\/+$/, "") : null,
    },
  };
}

export function readConfig(): ConfigResult {
  return parseConfig(import.meta.env);
}
