import { DEMO_STREAMS } from "./endpoints.mts";
import type { Recipe } from "./source-recipe.mts";

export const DEMO_SOURCE_KEY = "demo";

function hostsOf(urls: string[]): string[] {
  return [...new Set(urls.map((url) => new URL(url).hostname))];
}

// Stands in for the catalog api when no VITE_API_BASE is set: the app starts, plays a
// free stream and exercises the proxy without anything private (D12).
export function demoRecipe(): Recipe {
  return {
    version: 0,
    defaultHeaders: {},
    sources: {
      [DEMO_SOURCE_KEY]: {
        domains: hostsOf(DEMO_STREAMS.map((stream) => stream.url)),
        headers: {},
      },
    },
  };
}
