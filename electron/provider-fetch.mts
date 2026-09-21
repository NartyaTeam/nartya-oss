import http from "node:http";
import https from "node:https";
import { createDohHttpAgent, createDohHttpsAgent, dohAddresses } from "./doh.mts";
import { createLogger } from "./log.mts";
import { buildProviderRequest, DEFAULT_TIMEOUT_MS } from "./provider-request.mts";
import { validateExternalUrl, type Check } from "./url-safety.mts";

export type ProviderResponse = {
  url: string;
  status: number;
  statusText: string;
  headers: http.IncomingHttpHeaders;
  stream: http.IncomingMessage;
};

export type Validate = (url: string) => Promise<Check>;

export type FetchOptions = {
  provider?: string | null;
  rangeHeader?: string;
  signal?: AbortSignal;
};

const log = createLogger("provider-fetch");
const MAX_REDIRECTS = 5;

// Embed pages and cdn both go through the resolver the proxy uses. Without this,
// playback went over DoH while extraction and downloads stayed on the isp resolver.
const keepAlive = {
  keepAlive: true,
  keepAliveMsecs: 10_000,
  maxSockets: 32,
  maxFreeSockets: 16,
  timeout: 60_000,
};

const httpsAgent = createDohHttpsAgent({ family: 4, rejectUnauthorized: true, ...keepAlive });
const httpAgent = createDohHttpAgent(keepAlive);

function sharedAgent(url: URL): http.Agent {
  return url.protocol === "http:" ? httpAgent : httpsAgent;
}

function freshAgent(url: URL): http.Agent {
  return url.protocol === "http:"
    ? createDohHttpAgent()
    : createDohHttpsAgent({ family: 4, rejectUnauthorized: true });
}

function isRetryable(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: string; message?: string };
  if (code === "ECONNRESET" || code === "ECONNREFUSED") return true;
  return message?.includes("socket hang up") === true;
}

export function checkExternal(url: string): Promise<Check> {
  return validateExternalUrl(url, dohAddresses);
}

export function blocked(reason: string): Error {
  return Object.assign(new Error(`URL bloquée : ${reason}`), { code: "URL_BLOCKED" });
}

export type Attempt = {
  headers: Record<string, string>;
  method?: "GET" | "HEAD";
  agent: (url: URL) => http.Agent;
  timeoutMs: number;
  signal?: AbortSignal | undefined;
};

// The header timeout is cleared as soon as they arrive: past that point the body has its
// own stall guard, and a long download must not trip this one.
function send(url: URL, attempt: Attempt): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const open = url.protocol === "http:" ? http.request : https.request;
    const request = open(url, {
      method: attempt.method ?? "GET",
      headers: attempt.headers,
      agent: attempt.agent(url),
      ...(attempt.signal ? { signal: attempt.signal } : {}),
    });

    const timer = setTimeout(() => {
      request.destroy(
        new Error(`Timeout (${attempt.timeoutMs}ms) : aucune réponse de l'hébergeur`),
      );
    }, attempt.timeoutMs);

    request.on("response", (response) => {
      clearTimeout(timer);
      resolve(response);
    });
    request.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    request.end();
  });
}

// Redirects are followed by hand so every hop is validated: left to the agent, a public
// host could bounce the request to 127.0.0.1 or the lan.
export async function followChecked(
  start: string,
  attempt: Attempt,
  validate: Validate,
): Promise<ProviderResponse> {
  let current = start;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = await validate(current);
    if (!check.valid) throw blocked(check.error);

    const url = new URL(current);
    const response = await send(url, attempt);
    const status = response.statusCode ?? 0;
    const location = status >= 300 && status < 400 ? response.headers.location : undefined;
    if (!location) {
      return {
        url: current,
        status,
        statusText: response.statusMessage ?? "",
        headers: response.headers,
        stream: response,
      };
    }

    response.destroy();
    current = new URL(location, current).toString();
  }

  throw new Error("Trop de redirections");
}

export type UrlOptions = {
  headers: Record<string, string>;
  method?: "GET" | "HEAD";
  timeoutMs?: number;
  signal?: AbortSignal | undefined;
};

export async function fetchUrl(url: string, options: UrlOptions): Promise<ProviderResponse> {
  const attempt = { ...options, timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS };

  try {
    return await followChecked(url, { ...attempt, agent: sharedAgent }, checkExternal);
  } catch (error) {
    if (!isRetryable(error)) throw error;
    // A cdn closing a pooled connection just as it is reused: retry on a new one.
    log.debug("retrying on a fresh connection", { url, err: error });
    return followChecked(url, { ...attempt, agent: freshAgent }, checkExternal);
  }
}

export function fetchFromProvider(
  targetUrl: string,
  { provider, rangeHeader, signal }: FetchOptions = {},
): Promise<ProviderResponse> {
  const request = buildProviderRequest(targetUrl, provider, rangeHeader);
  return fetchUrl(request.url, {
    headers: request.headers,
    timeoutMs: request.timeoutMs,
    signal,
  });
}
