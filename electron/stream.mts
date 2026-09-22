import { createLogger } from "./log.mts";
import { fetchFromProvider } from "./provider-fetch.mts";
import { sourceRecipe } from "./source-recipe.mts";
import { createResolver, StreamError, type Embed } from "./stream-resolve.mts";
import { streamHandles } from "./stream-handles.mts";
import { extractor } from "./video-extract.mts";

const log = createLogger("stream");

const UNSEAL_TIMEOUT_MS = 10_000;
const PAGE_TIMEOUT_MS = 15_000;
const MAX_PAGE_BYTES = 4 * 1024 * 1024;

export type Session = { apiBase: string | null; accessToken: string | null; appVersion: string };

// The api answers the flat refusals in numbers; the viewer gets told what to do about it.
export function refusalOf(status: number): string {
  if (status === 401) return "Connecte-toi pour lancer la lecture.";
  if (status === 410) return "Lien expiré, recharge l'épisode.";
  if (status === 429) return "Trop de lectures d'affilée, patiente un instant.";
  return `Résolution indisponible (${String(status)})`;
}

export function readEmbed(body: unknown): Embed | null {
  const data = (body as { data?: unknown } | null)?.data;
  if (typeof data !== "object" || data === null) return null;
  const { url, provider } = data as { url?: unknown; provider?: unknown };
  if (typeof url !== "string" || !url) return null;
  return { url, provider: typeof provider === "string" && provider ? provider : null };
}

async function readBody(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk as Buffer);
    size += buffer.length;
    // An embed page is a few hundred kilobytes; anything past this is not one.
    if (size > MAX_PAGE_BYTES) throw new Error("page too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function createStreams(session: () => Session) {
  async function unseal(token: string): Promise<Embed> {
    const { apiBase, accessToken, appVersion } = session();
    if (!apiBase) throw new StreamError("Aucun catalogue configuré pour la lecture.");

    await sourceRecipe.ensure({ apiBaseUrl: apiBase, accessToken, appVersion });

    const response = await fetch(`${apiBase}/anime/stream/${encodeURIComponent(token)}`, {
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        "x-nartya-app-version": appVersion,
      },
      signal: AbortSignal.timeout(UNSEAL_TIMEOUT_MS),
    });
    if (!response.ok) throw new StreamError(refusalOf(response.status));

    const embed = readEmbed(await response.json());
    if (!embed) throw new StreamError("Source introuvable");
    return embed;
  }

  async function readPage(url: string, provider: string | null): Promise<string> {
    const response = await fetchFromProvider(url, {
      provider,
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (response.status >= 400) {
      response.stream.destroy();
      throw new Error(`host answered ${String(response.status)}`);
    }
    return readBody(response.stream);
  }

  const resolver = createResolver({
    unseal,
    readPage,
    extract: (html, embedUrl, provider) =>
      extractor.extractFromHtml(html, embedUrl, provider ?? undefined),
    consistent: (embedUrl, videoUrl) => extractor.matchesEmbed(embedUrl, videoUrl),
    mint: (target) => streamHandles.mint(target),
  });

  return {
    resolve: async (token: string, forceRefresh: boolean) => {
      const outcome = await resolver.resolve(token, forceRefresh);
      if (!outcome.ok) log.warn("resolve failed", { reason: outcome.error });
      return outcome;
    },
  };
}
