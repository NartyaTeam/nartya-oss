import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { createAuthFlows, type Purpose } from "./features/auth/flows.ts";
import { createAnime } from "./features/anime/anime.ts";
import { createCatalog } from "./features/catalog/catalog.ts";
import { createApi } from "./lib/api.ts";
import { readConfig } from "./lib/config.ts";
import { getPlatform } from "./lib/platform.ts";
import { createProgress } from "./features/player/progress.ts";
import { createFavorites } from "./features/favorites/favorites.ts";
import { createLists } from "./features/lists/lists.ts";
import { createResourceStore } from "./lib/resource-store.ts";
import { createSupabaseClient } from "./lib/supabase.ts";
import { startPresence } from "./features/presence/usePresence.ts";
import { MissingConfig } from "./ui/MissingConfig.tsx";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

const result = readConfig();

function start(): JSX.Element {
  if (!result.ok) return <MissingConfig missing={result.missing} />;

  const { config } = result;
  startPresence(config.discordClientId, config.siteUrl);
  const client = createSupabaseClient(config);
  const bridge = getPlatform()?.auth ?? null;

  const flows = createAuthFlows({
    client,
    bridge,
    captchaSiteKey: config.captchaSiteKey,
    browserRedirect: (purpose: Purpose) =>
      `${window.location.origin}/auth-callback?flow=${purpose}`,
  });

  // Without an api base there is no catalogue to read, and the screen says so rather than
  // failing call after call.
  const api = config.apiBase
    ? createApi({
        baseUrl: config.apiBase,
        token: async () => (await client.auth.getSession()).data.session?.access_token ?? null,
        version: __APP_VERSION__,
        platform: bridge ? "desktop" : "web",
      })
    : null;

  return (
    <App
      client={client}
      flows={flows}
      catalog={api ? createCatalog(api) : null}
      anime={api ? createAnime(api) : null}
      progress={createProgress(client)}
      favorites={createFavorites(client)}
      lists={createLists(client)}
      store={createResourceStore()}
      reachable={api ? api.reachable : null}
    />
  );
}

createRoot(root).render(<StrictMode>{start()}</StrictMode>);
