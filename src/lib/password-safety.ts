import { PWNED_RANGE_URL } from "./endpoints.ts";

// Supabase offers this natively on the Pro plan only, so the same source is queried here.
// Only the first five characters of the sha-1 are sent; the comparison happens locally.

export type Fetch = typeof globalThis.fetch;

async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export function countLeaksIn(body: string, suffix: string): number {
  for (const line of body.split("\n")) {
    const [candidate, count] = line.trim().split(":");
    // Padding entries carry a count of zero, so matching the suffix alone is enough.
    if (candidate === suffix) return Number.parseInt(count ?? "", 10) || 0;
  }
  return 0;
}

// Null means the check could not run: refusing an account because a third party is down
// would be worse than the risk it covers.
export async function countPasswordLeaks(
  password: string,
  fetcher: Fetch = globalThis.fetch,
): Promise<number | null> {
  try {
    const hash = await sha1Hex(password);
    // Padding hides the response size, which would otherwise narrow down the prefix asked.
    const response = await fetcher(PWNED_RANGE_URL + hash.slice(0, 5), {
      headers: { "Add-Padding": "true" },
    });
    if (!response.ok) return null;
    return countLeaksIn(await response.text(), hash.slice(5));
  } catch {
    return null;
  }
}
