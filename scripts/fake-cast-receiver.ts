import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import mdns from "multicast-dns";
import type { Answer } from "dns-packet";
import castv2 from "castv2";
import { localAddressFor } from "../electron/lan-address.mts";
import { fetchLikeATv } from "./fake-cast-fetch.ts";

const args = new Map(
  process.argv.slice(2).map((given) => {
    const [name, ...value] = given.replace(/^--/, "").split("=");
    return [name, value.join("=") || "true"];
  }),
);

const MODE = args.get("mode") ?? "complete";
const PORT = Number(args.get("port")) || 8010;
const IP = args.get("ip") ?? localAddressFor("192.168.1.1");
const FRIENDLY = args.get("name") ?? `TV de test (${MODE})`;
const SERVICE = "_googlecast._tcp.local";
const DURATION = 1440;

const uuid = crypto.randomBytes(16).toString("hex");
const INSTANCE = `Fake-Chromecast-${uuid}.${SERVICE}`;
const TARGET = `${uuid}.local`;

const NS = {
  heartbeat: "urn:x-cast:com.google.cast.tp.heartbeat",
  receiver: "urn:x-cast:com.google.cast.receiver",
  media: "urn:x-cast:com.google.cast.media",
};

const records = {
  PTR: { name: SERVICE, type: "PTR", ttl: 120, data: INSTANCE },
  TXT: {
    name: INSTANCE,
    type: "TXT",
    ttl: 120,
    data: [`id=${uuid}`, "md=Chromecast", `fn=${FRIENDLY}`, "ca=4101"],
  },
  SRV: {
    name: INSTANCE,
    type: "SRV",
    ttl: 120,
    data: { port: PORT, target: TARGET, priority: 0, weight: 0 },
  },
  A: { name: TARGET, type: "A", ttl: 120, data: IP },
} satisfies Record<string, Answer>;

const responder = mdns();

responder.on("query", (query, from) => {
  // A question asked from another port wants a unicast answer (RFC 6762 section 6.7).
  const to = from.port === 5353 ? undefined : { port: from.port, address: from.address };
  const reply = (answers: Answer[], additionals: Answer[] = []) =>
    responder.respond(
      { id: query.id, questions: to ? query.questions : [], answers, additionals },
      to,
    );

  for (const question of query.questions ?? []) {
    const name = String(question.name).toLowerCase();
    const type = String(question.type);
    if (name === SERVICE && (type === "PTR" || type === "ANY")) {
      console.log(`[mDNS] question PTR de ${from.address}:${from.port}, reponse ${MODE}`);
      if (MODE === "complete") reply([records.PTR], [records.TXT, records.SRV, records.A]);
      else if (MODE === "split") {
        reply([records.PTR]);
        setTimeout(() => reply([records.TXT]), 80);
        setTimeout(() => reply([records.SRV]), 160);
        setTimeout(() => reply([records.A]), 240);
      } else reply([records.PTR]);
    } else if (name === INSTANCE.toLowerCase() && (type === "SRV" || type === "TXT")) {
      console.log(`[mDNS] relance ${type} de ${from.address}`);
      reply([records[type]]);
    } else if (name === TARGET && type === "A") {
      console.log(`[mDNS] relance A de ${from.address}`);
      reply([records.A]);
    }
  }
});

function findOpenssl(): string {
  const programs = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs");
  const candidates = ["openssl"];
  for (const root of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], programs]) {
    if (!root) continue;
    candidates.push(path.join(root, "Git", "usr", "bin", "openssl.exe"));
    candidates.push(path.join(root, "Git", "mingw64", "bin", "openssl.exe"));
  }
  for (const binary of candidates) {
    try {
      execFileSync(binary, ["version"], { stdio: "ignore" });
      return binary;
    } catch {
      continue;
    }
  }
  console.error("openssl introuvable : ajoute-le au PATH (Git pour Windows le fournit).");
  process.exit(1);
}

const certDir = fs.mkdtempSync(path.join(os.tmpdir(), "fake-cast-"));
execFileSync(
  findOpenssl(),
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-subj",
    "/CN=fake-cast",
    "-keyout",
    path.join(certDir, "key.pem"),
    "-out",
    path.join(certDir, "cert.pem"),
  ],
  { stdio: "ignore" },
);

const server = new castv2.Server({
  key: fs.readFileSync(path.join(certDir, "key.pem")),
  cert: fs.readFileSync(path.join(certDir, "cert.pem")),
});

const APP = {
  appId: "CC1AD845",
  displayName: "Default Media Receiver",
  sessionId: "fake-session",
  transportId: "fake-transport",
  namespaces: [{ name: NS.media }],
};

let launched = false;
let media: { contentId: string; currentTime: number } | null = null;
let playerState = "IDLE";
let volume: { level: number; muted: boolean } = { level: 1, muted: false };
let clockAt = Date.now();

// Like a real television: the position moves on while playing, and nothing is broadcast.
const position = () => {
  if (!media) return 0;
  const running = playerState === "PLAYING" ? (Date.now() - clockAt) / 1000 : 0;
  return Math.min(DURATION, media.currentTime + running);
};

const setPosition = (seconds: number) => {
  if (media) media.currentTime = Math.max(0, Math.min(DURATION, Number(seconds) || 0));
  clockAt = Date.now();
};

const send = (clientId: string, from: string, to: string, namespace: string, payload: object) =>
  server.send(clientId, from, to, namespace, JSON.stringify(payload));

const receiverStatus = (requestId: number) => ({
  type: "RECEIVER_STATUS",
  requestId,
  status: { applications: launched ? [APP] : [], volume },
});

const mediaStatus = (requestId: number) => ({
  type: "MEDIA_STATUS",
  requestId,
  status: media
    ? [
        {
          mediaSessionId: 1,
          playerState,
          currentTime: position(),
          media: { contentId: media.contentId, duration: DURATION },
          volume: { level: 1, muted: false },
        },
      ]
    : [],
});

type Incoming = {
  type: string;
  requestId: number;
  appId?: string;
  currentTime?: number;
  volume?: { level?: number; muted?: boolean };
  media?: { contentId: string; contentType?: string };
};

async function onMedia(clientId: string, sourceId: string, data: Incoming): Promise<void> {
  if (data.type === "LOAD") {
    const asked = data.media?.contentId ?? "";
    console.log(`[Cast] LOAD ${data.media?.contentType} a ${data.currentTime}s, ${asked}`);
    let playable = args.has("no-fetch") ? false : await fetchLikeATv(asked);
    if (playable && args.has("reject-mp4") && data.media?.contentType === "video/mp4") {
      console.log("  lecture refusee (--reject-mp4)");
      playable = false;
    }
    if (!playable) {
      send(clientId, APP.transportId, sourceId, NS.media, {
        type: "LOAD_FAILED",
        requestId: data.requestId,
      });
      return;
    }
    media = { contentId: asked, currentTime: 0 };
    setPosition(data.currentTime ?? 0);
    playerState = "PLAYING";
  } else if (data.type === "PAUSE") {
    setPosition(position());
    playerState = "PAUSED";
  } else if (data.type === "PLAY") {
    setPosition(position());
    playerState = "PLAYING";
  } else if (data.type === "SEEK" && media) {
    console.log(`[Cast] SEEK ${Math.round(data.currentTime ?? 0)}s`);
    setPosition(data.currentTime ?? 0);
  }
  send(clientId, APP.transportId, sourceId, NS.media, mediaStatus(data.requestId));
}

server.on(
  "message",
  async (
    clientId: string,
    sourceId: string,
    destinationId: string,
    namespace: string,
    raw: string,
  ) => {
    let data: Incoming;
    try {
      data = JSON.parse(raw) as Incoming;
    } catch {
      return;
    }

    if (namespace === NS.heartbeat && data.type === "PING") {
      send(clientId, destinationId, sourceId, NS.heartbeat, { type: "PONG" });
      return;
    }
    if (namespace === NS.receiver) {
      if (data.type === "LAUNCH") {
        console.log(`[Cast] LAUNCH ${data.appId}`);
        launched = true;
      }
      if (data.type === "STOP") launched = false;
      if (data.type === "SET_VOLUME") {
        volume = { ...volume, ...data.volume };
        console.log(
          `[Cast] volume ${Math.round(volume.level * 100)}%${volume.muted ? " (muet)" : ""}`,
        );
      }
      send(clientId, "receiver-0", sourceId, NS.receiver, receiverStatus(data.requestId));
      return;
    }
    if (namespace === NS.media) await onMedia(clientId, sourceId, data);
  },
);

// An app that drops its connection must not take the fake receiver down with it.
server.server.on("secureConnection", (socket) => socket.on("error", () => {}));
server.on("error", (error: Error) => console.log("[Cast] erreur serveur :", error.message));

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Faux Chromecast "${FRIENDLY}" sur ${IP}:${PORT} (mode ${MODE}). Ctrl+C pour arreter.`,
  );
});

process.on("SIGINT", () => {
  responder.destroy();
  server.close();
  fs.rmSync(certDir, { recursive: true, force: true });
  process.exit(0);
});
