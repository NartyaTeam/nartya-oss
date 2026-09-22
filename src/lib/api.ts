export type ApiFailure = { ok: false; outdated: boolean; message: string };
export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

export type ApiParts = {
  baseUrl: string;
  token: () => Promise<string | null>;
  version: string;
  platform: "desktop" | "web";
  fetcher?: typeof globalThis.fetch;
  wait?: (ms: number) => Promise<void>;
};

const TIMEOUT_MS = 15_000;
const RETRIES = 2;
const BACKOFF_MS = 400;
const OUTDATED = 426;

const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

const UNREACHABLE = "Le catalogue est injoignable. Vérifie ta connexion.";
const OUT_OF_DATE = "Cette version de l'application n'est plus supportée.";
const BROKEN = "Le catalogue n'a pas pu être chargé.";

export function createApi(parts: ApiParts) {
  const { baseUrl, token, version, platform } = parts;
  const fetcher = parts.fetcher ?? globalThis.fetch;
  const wait = parts.wait ?? sleep;

  async function headers(): Promise<Record<string, string>> {
    // The api counts how many clients declare a version before it starts refusing those
    // that do not. Signed out, the call still goes out: the catalogue must not depend on it.
    const carried: Record<string, string> = {
      "x-nartya-app-version": version,
      "x-nartya-platform": platform,
    };
    const session = await token();
    if (session) carried["Authorization"] = `Bearer ${session}`;
    return carried;
  }

  async function get<T>(path: string): Promise<ApiResult<T>> {
    let last: ApiFailure = { ok: false, outdated: false, message: UNREACHABLE };

    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      const answer = await once<T>(path);
      if (answer.ok || answer.final) return answer.result;
      last = answer.result;
      if (attempt < RETRIES) await wait(BACKOFF_MS * 2 ** attempt);
    }
    return last;
  }

  type Attempt<T> =
    | { ok: true; final: true; result: ApiResult<T> }
    | { ok: false; final: boolean; result: ApiFailure };

  async function once<T>(path: string): Promise<Attempt<T>> {
    try {
      const response = await fetcher(`${baseUrl}${path}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: await headers(),
      });

      if (response.status === OUTDATED) {
        return {
          ok: false,
          final: true,
          result: { ok: false, outdated: true, message: OUT_OF_DATE },
        };
      }
      // A 5xx is the api rebuilding its caches; a 4xx is an answer, and retrying it only
      // makes the same mistake three times.
      if (!response.ok) {
        const message = response.status >= 500 ? UNREACHABLE : BROKEN;
        return {
          ok: false,
          final: response.status < 500,
          result: { ok: false, outdated: false, message },
        };
      }

      const body = (await response.json()) as { success?: boolean; data?: T; error?: string };
      if (body.success === false || body.data === undefined) {
        return {
          ok: false,
          final: true,
          result: { ok: false, outdated: false, message: body.error ?? BROKEN },
        };
      }
      return { ok: true, final: true, result: { ok: true, data: body.data } };
    } catch {
      return {
        ok: false,
        final: false,
        result: { ok: false, outdated: false, message: UNREACHABLE },
      };
    }
  }

  return { get };
}

export type Api = ReturnType<typeof createApi>;
