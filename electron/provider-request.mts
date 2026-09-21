import { compilePattern, sourceRecipe, type RecipeStore, type Source } from "./source-recipe.mts";

export type ProviderRequest = {
  url: string;
  headers: Record<string, string>;
  timeoutMs: number;
};

export const DEFAULT_TIMEOUT_MS = 30_000;

// Some hosts run on several extensions, including dead ones. Driven by the recipe: no
// domain is written down here.
function canonicalize(url: string, source: Source | null): string {
  if (!source?.canonicalHost || !source.hostMatch) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes(source.hostMatch)) return url;
    if (parsed.hostname.endsWith(source.canonicalHost)) return url;
    parsed.hostname = source.canonicalHost;
    return parsed.toString();
  } catch {
    return url;
  }
}

// A few hosts only serve their mp4 with the player page as Referer, rebuilt from the id
// in the media url itself.
export function mediaReferer(mediaUrl: string, source: Source | null): string | null {
  const rule = source?.mp4Referer;
  if (!rule?.pattern || !rule.template) return null;

  const match = compilePattern(rule.pattern, "")?.exec(mediaUrl);
  if (!match) return null;
  return rule.template.replace(/\{(\d+)\}/g, (_, index: string) => match[Number(index)] ?? "");
}

function hostHeaders(url: string, source: Source, headers: Record<string, string>): void {
  if (!source.dropRefererOffHost || !source.hostMatch) return;
  try {
    const parsed = new URL(url);
    // On its own domain the Referer follows the real host; on a third party cdn keeping
    // it earns a 403.
    if (parsed.hostname.includes(source.hostMatch)) {
      headers.Referer = `${parsed.origin}/`;
      headers.Origin = parsed.origin;
    } else {
      delete headers.Referer;
      delete headers.Origin;
    }
  } catch {
    return;
  }
}

export function createRequestBuilder(store: RecipeStore) {
  // An unknown host falls back to neutral headers: enough for a third party cdn, never
  // enough to impersonate a host we do not know.
  return function build(
    targetUrl: string,
    provider?: string | null,
    rangeHeader?: string,
  ): ProviderRequest {
    const key = provider ?? store.detectKey(targetUrl);
    const source = store.getSource(key);
    const url = canonicalize(targetUrl, source);

    const headers = { ...(source ? source.headers : store.defaultHeaders()) };
    if (source) hostHeaders(url, source, headers);

    const referer = mediaReferer(url, source);
    if (referer) headers.Referer = referer;
    if (rangeHeader) headers.Range = rangeHeader;

    return { url, headers, timeoutMs: source?.timeout ?? DEFAULT_TIMEOUT_MS };
  };
}

export const buildProviderRequest = createRequestBuilder(sourceRecipe);
