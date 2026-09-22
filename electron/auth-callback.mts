import http from "node:http";
import { captchaPage, isSiteKey } from "./captcha.mts";

const HOST = "127.0.0.1";
const CALLBACK_PATH = "/auth-callback";
const CAPTCHA_PATH = "/captcha";
const CAPTCHA_TOKEN_PATH = "/captcha-token";

// A custom scheme is unreliable on Linux and ChromeOS, where the system browser does not
// hand the deep link to the app, so RFC 8252 loopback is the default.

// These exact ports have to be allowed as redirect urls in the auth provider.
export const CANDIDATE_PORTS = [8351, 8352, 8353];

export type OnCallback = (url: string) => void;

export type Handlers = { onCallback: OnCallback; onCaptcha: (token: string) => void };

export type ErrorCopy = { title: string; message: string };

export function oauthErrorCopy(params: URLSearchParams): ErrorCopy {
  const raw =
    params.get("error_description") ?? params.get("error_code") ?? params.get("error") ?? "";
  const reason = decodeURIComponent(raw.replaceAll("+", " ")).toLowerCase();

  if (reason.includes("identity is already linked") || reason.includes("identity_already_exists")) {
    return {
      title: "Ce compte est déjà utilisé",
      message:
        "Il est déjà lié à un autre compte. Connectez-vous à celui-ci, ou choisissez-en un autre.",
    };
  }
  if (reason.includes("access_denied")) {
    return {
      title: "Autorisation annulée",
      message: "Aucune modification n'a été apportée à votre compte.",
    };
  }
  return {
    title: "Échec de la connexion",
    message: "Refermez cet onglet et réessayez depuis l'application.",
  };
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const STYLE =
  "html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;" +
  "text-align:center;font-family:system-ui,sans-serif;background:#0b0b0f;color:#f5f5f7}" +
  ".card{max-width:440px;padding:40px 28px}h1{font-size:20px;margin:0 0 10px}" +
  "p{font-size:14px;color:#a1a1aa;margin:0;line-height:1.6}";

function page(title: string, message: string, closes: boolean): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title><style>${STYLE}</style></head>
<body><main class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main>
${closes ? "<script>setTimeout(function(){try{window.close()}catch(e){}},800)</script>" : ""}
</body></html>`;
}

export function createAuthCallbackServer(ports: number[] = CANDIDATE_PORTS) {
  let server: http.Server | null = null;
  let port: number | null = null;
  let handlers: Handlers | null = null;

  function send(response: http.ServerResponse, status: number, html: string): void {
    response.writeHead(status, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
  }

  function handle(request: http.IncomingMessage, response: http.ServerResponse): void {
    let parsed: URL;
    try {
      parsed = new URL(request.url ?? "", `http://${HOST}:${String(port)}`);
    } catch {
      response.writeHead(400, { "content-type": "text/plain" });
      response.end("Bad Request");
      return;
    }

    if (parsed.pathname === CAPTCHA_PATH) {
      const key = parsed.searchParams.get("key");
      if (!isSiteKey(key)) {
        send(
          response,
          400,
          page("Clé manquante", "L'application n'a pas de clé de captcha.", false),
        );
        return;
      }
      send(response, 200, captchaPage(key, CAPTCHA_TOKEN_PATH));
      return;
    }

    if (parsed.pathname === CAPTCHA_TOKEN_PATH) {
      const token = parsed.searchParams.get("token") ?? "";
      if (token) handlers?.onCaptcha(token);
      response.writeHead(token ? 200 : 400, { "content-type": "text/plain" });
      response.end(token ? "ok" : "no token");
      return;
    }

    if (parsed.pathname !== CALLBACK_PATH) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("Not Found");
      return;
    }

    handlers?.onCallback(`http://${HOST}:${String(port)}${request.url ?? ""}`);

    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    if (parsed.searchParams.has("code")) {
      response.end(
        page(
          "Connexion réussie",
          "Vous pouvez fermer cet onglet et revenir à l'application.",
          true,
        ),
      );
      return;
    }
    const copy = oauthErrorCopy(parsed.searchParams);
    response.end(page(copy.title, copy.message, false));
  }

  function listen(candidate: number): Promise<http.Server> {
    return new Promise((resolve, reject) => {
      const next = http.createServer(handle);
      next.once("error", reject);
      next.listen(candidate, HOST, () => {
        next.removeListener("error", reject);
        resolve(next);
      });
    });
  }

  return {
    async start(next: Handlers): Promise<number | null> {
      handlers = next;
      for (const candidate of ports) {
        try {
          server = await listen(candidate);
          port = candidate;
          return candidate;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") continue;
          return null;
        }
      }
      return null;
    },

    redirectUrl(): string | null {
      return port === null ? null : `http://${HOST}:${String(port)}${CALLBACK_PATH}`;
    },

    captchaUrl(siteKey: string): string | null {
      if (port === null) return null;
      return `http://${HOST}:${String(port)}${CAPTCHA_PATH}?key=${encodeURIComponent(siteKey)}`;
    },

    stop(): void {
      server?.close();
      server = null;
      port = null;
    },
  };
}
