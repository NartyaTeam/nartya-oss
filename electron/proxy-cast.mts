import crypto from "node:crypto";
import http from "node:http";
import { createLogger } from "./log.mts";

export type Handler = (request: http.IncomingMessage, response: http.ServerResponse) => void;

const log = createLogger("proxy-cast");

// Open on the local network only while casting, with its own token: the television fetches
// the video itself, and the loopback token must not open a door onto the network.
export function createCastListener(handle: Handler) {
  let server: http.Server | null = null;
  let port: number | null = null;
  let token: string | null = null;
  let starting: Promise<number | null> | null = null;

  function start(): Promise<number | null> {
    if (port !== null) return Promise.resolve(port);
    // Two devices picked at once would otherwise open two listeners, and stop() only ever
    // closes the last one.
    if (starting) return starting;

    token = crypto.randomBytes(24).toString("base64url");
    const listener = http.createServer(handle);

    starting = new Promise<number | null>((resolve, reject) => {
      listener.on("error", reject);
      listener.listen(0, "0.0.0.0", () => {
        const address = listener.address();
        port = typeof address === "object" && address ? address.port : null;
        server = listener;
        log.info("open", { port });
        resolve(port);
      });
    }).finally(() => {
      starting = null;
    });
    return starting;
  }

  function stop(): void {
    starting = null;
    if (!server) return;
    server.close();
    server = null;
    port = null;
    token = null;
    log.info("closed");
  }

  return {
    start,
    stop,
    get port() {
      return port;
    },
    get token() {
      return token;
    },
  };
}

export type CastListener = ReturnType<typeof createCastListener>;
