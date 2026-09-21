import { demoRecipe } from "./demo-recipe.mts";
import { createLogger } from "./log.mts";

const log = createLogger("source-recipe");

export type MediaReferer = { pattern: string; template: string };

export type Source = {
  domains?: string[];
  strategy?: string;
  headers?: Record<string, string>;
  timeout?: number;
  exclusive?: boolean;
  hostMatch?: string;
  canonicalHost?: string;
  dropRefererOffHost?: boolean;
  rejectPattern?: string;
  mediaPattern?: string;
  mediaBase?: string;
  mp4Referer?: MediaReferer;
};

export type Recipe = {
  version?: number;
  defaultHeaders?: Record<string, string>;
  sources: Record<string, Source>;
};

export type Credentials = { apiBaseUrl: string; accessToken: string | null };
export type Load = (credentials: Credentials | null) => Promise<Recipe>;

const RECIPE_PATH = "/anime/sources/recipe";
const REQUEST_TIMEOUT_MS = 10_000;
// Only moves when the api deploys, but an hour still propagates a fixed host quickly.
const TTL_MS = 60 * 60_000;

export function readRecipe(body: unknown): Recipe | null {
  if (typeof body !== "object" || body === null) return null;
  const payload = (body as { data?: unknown }).data;
  if (typeof payload !== "object" || payload === null) return null;
  const { sources, defaultHeaders, version } = payload as {
    sources?: unknown;
    defaultHeaders?: unknown;
    version?: unknown;
  };
  if (typeof sources !== "object" || sources === null || Array.isArray(sources)) return null;

  const recipe: Recipe = { sources: sources as Record<string, Source> };
  if (typeof defaultHeaders === "object" && defaultHeaders !== null) {
    recipe.defaultHeaders = defaultHeaders as Record<string, string>;
  }
  if (typeof version === "number") recipe.version = version;
  return recipe;
}

export async function fetchRecipe(credentials: Credentials | null): Promise<Recipe> {
  if (!credentials) return demoRecipe();

  const { apiBaseUrl, accessToken } = credentials;
  const response = await fetch(`${apiBaseUrl}${RECIPE_PATH}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`recipe: HTTP ${response.status}`);
  const recipe = readRecipe(await response.json());
  if (!recipe) throw new Error("recipe: malformed payload");
  return recipe;
}

// The table never touches the disk: writing it back would recreate the plain file that
// pulling it out of the bundle was meant to remove.
export function createRecipeStore(load: Load = fetchRecipe, ttlMs: number = TTL_MS) {
  let recipe: Recipe | null = null;
  let loadedAt = 0;
  let pending: Promise<Recipe | null> | null = null;
  let credentials: Credentials | null = null;

  function ensure(next?: Credentials): Promise<Recipe | null> {
    if (next?.apiBaseUrl) credentials = next;
    if (recipe && Date.now() - loadedAt < ttlMs) return Promise.resolve(recipe);
    if (pending) return pending;

    const request = load(credentials)
      .then((loaded) => {
        recipe = loaded;
        loadedAt = Date.now();
        log.info("loaded", {
          sources: Object.keys(loaded.sources).length,
          version: loaded.version,
        });
        return recipe;
      })
      // A slightly stale table beats a dead playback when the api hiccups.
      .catch((error: unknown) => {
        log.warn("load failed", { err: error, stale: recipe !== null });
        return recipe;
      })
      .finally(() => {
        pending = null;
      });

    pending = request;
    return request;
  }

  function get(): Recipe | null {
    return recipe;
  }

  function getSource(key: string | null): Source | null {
    if (!key) return null;
    return recipe?.sources[key] ?? null;
  }

  function defaultHeaders(): Record<string, string> {
    return recipe?.defaultHeaders ?? {};
  }

  // Without a recipe nothing can be claimed, and nothing is guessed: that was the point
  // of taking the table out of the bundle.
  function detectKey(url: string): string | null {
    if (!url || !recipe) return null;
    const lower = url.toLowerCase();
    for (const [key, source] of Object.entries(recipe.sources)) {
      if (source.domains?.some((domain) => lower.includes(domain))) return key;
    }
    return null;
  }

  function isAllowedEmbedHost(hostname: string): boolean {
    if (!recipe) return false;
    const host = hostname.toLowerCase();
    for (const source of Object.values(recipe.sources)) {
      for (const domain of source.domains ?? []) {
        if (host === domain || host.endsWith(`.${domain}`)) return true;
      }
    }
    return false;
  }

  function set(next: Recipe): void {
    recipe = next;
    loadedAt = Date.now();
  }

  return { ensure, get, getSource, defaultHeaders, detectKey, isAllowedEmbedHost, set };
}

export type RecipeStore = ReturnType<typeof createRecipeStore>;

export const sourceRecipe = createRecipeStore();

export function compilePattern(pattern: string | undefined, flags = "i"): RegExp | null {
  if (!pattern) return null;
  try {
    return new RegExp(pattern, flags);
  } catch {
    log.warn("invalid pattern ignored", { pattern });
    return null;
  }
}
