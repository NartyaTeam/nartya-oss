import { randomUUID } from "node:crypto";
import { connect, type Socket } from "node:net";
import { join } from "node:path";
import type { Activity } from "./discord-presence.mts";
import { encodeFrame, frameReader, OP } from "./discord-frames.mts";
import { createLogger } from "./log.mts";

const log = createLogger("discord");

const PIPES = 10;
const RECONNECT_MS = 30_000;

// Discord listens on the first free of ten pipes, so a second client ends up further along.
export function discordPipes(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
  const indexes = [...Array(PIPES).keys()];
  if (platform === "win32") return indexes.map((index) => `\\\\?\\pipe\\discord-ipc-${index}`);
  const base = env["XDG_RUNTIME_DIR"] ?? env["TMPDIR"] ?? env["TMP"] ?? env["TEMP"] ?? "/tmp";
  return indexes.map((index) => join(base, `discord-ipc-${index}`));
}

type LinkParts = {
  pipes: string[];
  pid: number;
  reconnectMs?: number;
};

function reach(path: string): Promise<Socket | null> {
  return new Promise((resolve) => {
    const socket = connect(path);
    socket.once("connect", () => {
      socket.removeAllListeners("error");
      resolve(socket);
    });
    socket.once("error", () => resolve(null));
  });
}

function isReady(payload: unknown): boolean {
  return (
    typeof payload === "object" && payload !== null && "evt" in payload && payload.evt === "READY"
  );
}

// Discord not running is the usual case: the link keeps knocking, quietly.
export function createDiscordLink({ pipes, pid, reconnectMs = RECONNECT_MS }: LinkParts) {
  let clientId: string | null = null;
  let socket: Socket | null = null;
  let connecting = false;
  let ready = false;
  let stopped = false;
  let activity: Activity | null = null;
  let retry: NodeJS.Timeout | null = null;

  function send(op: number, payload: unknown): void {
    socket?.write(encodeFrame(op, payload));
  }

  function publish(): void {
    if (!ready) return;
    send(OP.frame, {
      cmd: "SET_ACTIVITY",
      args: { pid, ...(activity && { activity }) },
      nonce: randomUUID(),
    });
  }

  function later(): void {
    if (stopped || retry) return;
    retry = setTimeout(() => {
      retry = null;
      void open();
    }, reconnectMs);
  }

  function onFrame(op: number, payload: unknown): void {
    if (op === OP.ping) send(OP.pong, payload);
    else if (op === OP.close) socket?.destroy();
    else if (op === OP.frame && isReady(payload)) {
      ready = true;
      publish();
    }
  }

  async function open(): Promise<void> {
    if (stopped || socket || connecting || !clientId) return;
    connecting = true;
    let found: Socket | null = null;
    for (const path of pipes) {
      found = await reach(path);
      if (found) break;
    }
    connecting = false;
    if (!found || stopped) {
      found?.destroy();
      later();
      return;
    }

    const opened = found;
    socket = opened;
    opened.on("data", frameReader(onFrame));
    opened.on("error", (err) => log.debug("pipe error", { err }));
    opened.on("close", () => {
      if (socket === opened) socket = null;
      ready = false;
      later();
    });
    send(OP.handshake, { v: 1, client_id: clientId });
  }

  return {
    start(id: string): void {
      clientId = id;
      void open();
    },
    set(next: Activity | null): void {
      activity = next;
      publish();
    },
    stop(): void {
      stopped = true;
      if (retry) clearTimeout(retry);
      socket?.destroy();
    },
  };
}
