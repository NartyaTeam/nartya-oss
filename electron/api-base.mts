import { readFileSync } from "node:fs";
import { join } from "node:path";

// Fixed in the main process on purpose: the session token rides on these calls, so the
// renderer must never get to choose where they go.
export type BuildConfig = { apiBase?: string };

function fromFile(dir: string): string | null {
  try {
    const raw = readFileSync(join(dir, "build-config.json"), "utf8");
    const parsed = JSON.parse(raw) as BuildConfig;
    return typeof parsed.apiBase === "string" ? parsed.apiBase : null;
  } catch {
    return null;
  }
}

// A source checkout has no build-config: the address then comes from the .env the front
// end already reads, two levels above the compiled main process.
function fromDotEnv(dir: string): string | null {
  try {
    const raw = readFileSync(join(dir, "..", "..", ".env"), "utf8");
    const line = raw.split(/\r?\n/).find((entry) => entry.trimStart().startsWith("VITE_API_BASE="));
    if (!line) return null;
    const value = line.slice(line.indexOf("=") + 1).trim();
    return value.replace(/^["']|["']$/g, "");
  } catch {
    return null;
  }
}

export function normalize(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      return null;
    }
  } catch {
    return null;
  }
  return trimmed.replace(/\/+$/, "");
}

export function readApiBase(dir: string, env: NodeJS.ProcessEnv = process.env): string | null {
  return (
    normalize(env["NARTYA_API_BASE"]) ?? normalize(fromFile(dir)) ?? normalize(fromDotEnv(dir))
  );
}
