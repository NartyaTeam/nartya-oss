import tls from "node:tls";
import { Client, DefaultMediaReceiver, type MediaStatus, type Volume } from "castv2-client";
import { createLogger } from "./log.mts";

export type CastDevice = { host: string; port: number };

export type CastMedia = {
  url: string;
  contentType?: string;
  title?: string;
  poster?: string;
  startAt?: number;
};

export type CastStage = "connect" | "launch" | "load";

export type CastStatus = {
  playerState: string | null;
  idleReason: string | null;
  currentTime: number | null;
  duration: number | null;
  volume: number | null;
  muted: boolean | null;
};

export type CastHandlers = {
  onStatus: (status: CastStatus) => void;
  onClosed: (reason: string) => void;
};

const log = createLogger("cast-session");

const CONNECT_TIMEOUT_MS = 8_000;
const LOAD_TIMEOUT_MS = 30_000;
const STATUS_EVERY_MS = 1_000;
const DEFAULT_CONTENT_TYPE = "application/vnd.apple.mpegurl";
const RESUME_FLOOR_SECONDS = 2;

export function stageOf(error: unknown): CastStage {
  const stage = (error as { stage?: CastStage } | null)?.stage;
  return stage ?? "connect";
}

// A device that answers on the cast port is reachable; a manual address is worth nothing
// until we know that much.
export function probeCastPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = tls.connect({
      host,
      port,
      rejectUnauthorized: false,
      timeout: CONNECT_TIMEOUT_MS,
    });
    const done = (reachable: boolean) => {
      socket.destroy();
      resolve(reachable);
    };
    socket.once("secureConnect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function loadRequest(media: CastMedia) {
  return {
    contentId: media.url,
    contentType: media.contentType || DEFAULT_CONTENT_TYPE,
    streamType: "BUFFERED" as const,
    metadata: {
      type: 0,
      metadataType: 0,
      title: media.title || "Nartya",
      images: media.poster ? [{ url: media.poster }] : [],
    },
  };
}

export function openCastSession(
  device: CastDevice,
  media: CastMedia,
  handlers: CastHandlers,
): Promise<CastSession> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let stage: CastStage = "connect";
    let settled = false;
    let timer: NodeJS.Timeout | null = null;

    const fail = (error: Error | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      client.close();
      reject(Object.assign(error ?? new Error("cast failed"), { stage }));
    };
    const arm = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fail(new Error(`timeout (${stage})`)), ms);
    };

    client.on("error", fail);
    arm(CONNECT_TIMEOUT_MS);

    client.connect({ host: device.host, port: device.port }, () => {
      stage = "launch";
      arm(LOAD_TIMEOUT_MS);

      client.launch(DefaultMediaReceiver, (error, player) => {
        if (error) {
          fail(error);
          return;
        }
        stage = "load";
        const startAt = Number(media.startAt);
        const resumeAt = startAt > RESUME_FLOOR_SECONDS ? Math.floor(startAt) : 0;

        player.load(
          loadRequest(media),
          { autoplay: true, currentTime: resumeAt },
          (loadError, status) => {
            if (loadError) {
              fail(loadError);
              return;
            }
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            client.removeListener("error", fail);
            resolve(startSession(client, player, status, handlers));
          },
        );
      });
    });
  });
}

function startSession(
  client: Client,
  player: DefaultMediaReceiver,
  loaded: MediaStatus,
  handlers: CastHandlers,
): CastSession {
  let media: MediaStatus | null = loaded;
  let volume: Volume | null = null;
  let closed = false;

  // The library does not record the media session on load, so an immediate seek throws.
  if (loaded && !player.media.currentSession) player.media.currentSession = loaded;

  function publish(): void {
    handlers.onStatus({
      playerState: media?.playerState ?? null,
      idleReason: media?.idleReason ?? null,
      currentTime: media?.currentTime ?? null,
      duration: media?.media?.duration ?? null,
      // Device volume lives in the receiver status; the media one usually stays at 1.
      volume: volume?.level ?? media?.volume?.level ?? null,
      muted: volume?.muted ?? media?.volume?.muted ?? null,
    });
  }

  function onMediaStatus(status: MediaStatus | null): void {
    if (!status || closed) return;
    media = status;
    publish();
    if (status.playerState === "IDLE" && status.idleReason === "ERROR") end("media-error");
  }

  function onVolume(level: Volume | null): void {
    if (!level || closed) return;
    volume = level;
    publish();
  }

  function end(reason: string): void {
    if (closed) return;
    closed = true;
    clearInterval(poll);
    client.close();
    handlers.onClosed(reason);
  }

  // The device broadcasts nothing as playback advances, so the position is polled; the
  // replies come back through the same handler.
  const poll = setInterval(() => {
    player.getStatus((error, status) => {
      if (!error) onMediaStatus(status);
    });
  }, STATUS_EVERY_MS);

  player.on("status", onMediaStatus);
  client.on("status", (status: { volume?: Volume }) => onVolume(status?.volume ?? null));
  client.on("error", (error: Error) => {
    log.warn("device dropped the session", { err: error });
    end("error");
  });
  client.on("close", () => end("device-closed"));

  client.getVolume((error, level) => {
    if (!error) onVolume(level);
  });
  publish();

  function ask<T>(call: (done: (error: Error | null, value: T) => void) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      call((error) => (error ? reject(error) : resolve()));
    });
  }

  return {
    play: () => ask<MediaStatus>((done) => player.play(wrap(onMediaStatus, done))),
    pause: () => ask<MediaStatus>((done) => player.pause(wrap(onMediaStatus, done))),
    seek: (seconds: number) =>
      ask<MediaStatus>((done) => player.seek(seconds, wrap(onMediaStatus, done))),
    setVolume: (level: number) =>
      ask<Volume>((done) => client.setVolume({ level }, wrap(onVolume, done))),
    setMuted: (muted: boolean) =>
      ask<Volume>((done) => client.setVolume({ muted }, wrap(onVolume, done))),
    close: () => {
      if (closed) return;
      closed = true;
      clearInterval(poll);
      client.close();
    },
    get ready() {
      return player.media.currentSession !== null;
    },
  };
}

function wrap<T>(
  apply: (value: T | null) => void,
  done: (error: Error | null, value: T) => void,
): (error: Error | null, value: T) => void {
  return (error, value) => {
    if (!error) apply(value);
    done(error, value);
  };
}

export type CastSession = {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  setVolume: (level: number) => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
  close: () => void;
  readonly ready: boolean;
};
