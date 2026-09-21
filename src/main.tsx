import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { readConfig } from "./lib/config.ts";
import { createSupabaseClient } from "./lib/supabase.ts";
import { MissingConfig } from "./ui/MissingConfig.tsx";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

const result = readConfig();

createRoot(root).render(
  <StrictMode>
    {result.ok ? (
      <App client={createSupabaseClient(result.config)} />
    ) : (
      <MissingConfig missing={result.missing} />
    )}
  </StrictMode>,
);
