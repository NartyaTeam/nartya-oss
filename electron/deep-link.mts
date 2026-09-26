export const DEEP_LINK_SCHEME = "nartya";

const PREFIX = `${DEEP_LINK_SCHEME}://`;
const MAX_LENGTH = 2048;

// The website's links carry an open/ prefix: nartya://open/anime/<slug>.
export function routeForLink(link: string): string | null {
  if (link.length > MAX_LENGTH || !link.startsWith(PREFIX)) return null;
  let path = link.slice(PREFIX.length);
  if (path.startsWith("open/")) path = path.slice("open/".length);
  if (!path.startsWith("anime/")) return null;

  const raw = path.slice("anime/".length).split(/[?#/]/)[0] ?? "";
  let slug: string;
  try {
    slug = decodeURIComponent(raw).trim();
  } catch {
    return null;
  }
  return slug ? `/anime/${encodeURIComponent(slug)}` : null;
}

export const linkIn = (argv: string[]): string | null =>
  argv.find((argument) => argument.startsWith(PREFIX)) ?? null;

// Held until the app asks: a link can arrive before the window, or while signing in.
export function createDeepLinks() {
  let pending: string | null = null;
  return {
    receive(link: string): boolean {
      const route = routeForLink(link);
      if (route) pending = route;
      return route !== null;
    },
    take(): string | null {
      const route = pending;
      pending = null;
      return route;
    },
  };
}
