import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { createAuthFlows, type Purpose } from "./features/auth/flows.ts";
import { readConfig } from "./lib/config.ts";
import { getPlatform } from "./lib/platform.ts";
import { createSupabaseClient } from "./lib/supabase.ts";
import { MissingConfig } from "./ui/MissingConfig.tsx";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

const result = readConfig();

function start(): JSX.Element {
  if (!result.ok) return <MissingConfig missing={result.missing} />;

  const client = createSupabaseClient(result.config);
  const flows = createAuthFlows({
    client,
    bridge: getPlatform()?.auth ?? null,
    browserRedirect: (purpose: Purpose) =>
      `${window.location.origin}/auth-callback?flow=${purpose}`,
  });
  return <App client={client} flows={flows} />;
}

createRoot(root).render(<StrictMode>{start()}</StrictMode>);
