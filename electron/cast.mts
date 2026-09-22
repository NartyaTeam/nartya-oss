import { createDiscovery, type Diagnostics } from "./cast-discovery.mts";
import { explainCastFailure, type CastFailure } from "./cast-failure.mts";
import { DEFAULT_CAST_PORT, type Device } from "./cast-registry.mts";
import {
  openCastSession,
  probeCastPort,
  stageOf,
  type CastMedia,
  type CastSession,
  type CastStatus,
} from "./cast-session.mts";
import { firewallStatus, type FirewallStatus } from "./firewall.mts";
import { isPrivateIpv4 } from "./lan-address.mts";
import { createLogger } from "./log.mts";

export type CastAction = "play" | "pause" | "seek" | "stop" | "volume" | "mute";

export type CastState = CastStatus & {
  deviceId: string | null;
  deviceName: string | null;
  ended?: boolean;
  reason?: string;
};

export type CastResult = { success: boolean; error?: string; mediaFailed?: boolean };

export type CastParts = {
  castUrl: (localUrl: string, deviceIp: string) => Promise<string | null>;
  stopCastListener: () => void;
  lastCastRequestFrom: (ip: string) => number;
  onDevices: (devices: Device[]) => void;
  onStatus: (state: CastState) => void;
  openSession?: typeof openCastSession;
  probe?: typeof probeCastPort;
  firewall?: () => Promise<FirewallStatus | null>;
};

const log = createLogger("cast");

const NOTHING: CastStatus = {
  playerState: null,
  idleReason: null,
  currentTime: null,
  duration: null,
  volume: null,
  muted: null,
};

export function createCast(parts: CastParts) {
  const openSession = parts.openSession ?? openCastSession;
  const probe = parts.probe ?? probeCastPort;
  const firewall = parts.firewall ?? firewallStatus;

  let target: Device | null = null;
  let session: CastSession | null = null;

  const discovery = createDiscovery({
    onDevices: parts.onDevices,
    busyId: () => target?.id ?? null,
  });

  function emit(status: CastStatus | null, extra: Partial<CastState> = {}): void {
    parts.onStatus({
      ...(status ?? NOTHING),
      deviceId: target?.id ?? null,
      deviceName: target?.name ?? null,
      ...extra,
    });
  }

  function end(reason: string): void {
    if (!target && !session) return;
    const closing = session;
    session = null;
    target = null;
    closing?.close();
    emit(null, { ended: true, reason });
    parts.stopCastListener();
    log.info("session ended", { reason });
  }

  async function start(deviceId: string, media: CastMedia): Promise<CastResult> {
    const device = discovery.devices().find((known) => known.id === deviceId);
    if (!device) return { success: false, error: "Appareil introuvable, relance la recherche." };
    if (!media.url) return { success: false, error: "Aucune vidéo à caster pour le moment." };

    // Ending the previous session closes the lan listener and drops its token, so the url
    // has to be minted after that, not before.
    end("switch");

    const url = await parts.castUrl(media.url, device.host);
    if (!url) {
      return { success: false, error: "Cette vidéo ne peut pas être castée.", mediaFailed: true };
    }
    target = device;
    const askedAt = Date.now();

    try {
      const opened = await openSession(
        { host: device.host, port: device.port },
        { ...media, url },
        { onStatus: (status) => emit(status), onClosed: (reason) => end(reason) },
      );
      // The device can hang up while we are still waiting on the load.
      if (target !== device) {
        opened.close();
        return { success: false, error: "La lecture s'est interrompue." };
      }
      session = opened;
      return { success: true };
    } catch (error) {
      const stage = stageOf(error);
      log.warn("cast failed", { stage, err: error });
      target = null;
      session = null;
      const failure = await describe(stage, device.host, askedAt);
      parts.stopCastListener();
      return { success: false, ...failure };
    }
  }

  async function describe(
    stage: ReturnType<typeof stageOf>,
    host: string,
    askedAt: number,
  ): Promise<CastFailure> {
    const reached = parts.lastCastRequestFrom(host) >= askedAt;
    return explainCastFailure(stage, reached, reached ? null : await firewall());
  }

  async function control(action: CastAction, value?: number | boolean): Promise<CastResult> {
    const active = session;
    if (!active) return { success: false, error: "Aucun cast actif" };
    if (action === "stop") {
      end("stop");
      return { success: true };
    }
    if (!active.ready && (action === "play" || action === "pause" || action === "seek")) {
      return { success: false, error: "Lecture pas encore prête" };
    }

    try {
      await apply(active, action, value);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  function apply(
    active: CastSession,
    action: CastAction,
    value: number | boolean | undefined,
  ): Promise<void> {
    switch (action) {
      case "play":
        return active.play();
      case "pause":
        return active.pause();
      case "seek":
        return active.seek(Number(value) || 0);
      case "volume":
        return active.setVolume(Math.max(0, Math.min(1, Number(value) || 0)));
      case "mute":
        return active.setMuted(Boolean(value));
      default:
        return Promise.reject(new Error("Action inconnue"));
    }
  }

  async function addHost(ip: string): Promise<CastResult & { device?: Device }> {
    if (!isPrivateIpv4(ip)) {
      return { success: false, error: "Adresse IP locale invalide (ex. 192.168.1.20)" };
    }
    if (!(await probe(ip, DEFAULT_CAST_PORT))) {
      return { success: false, error: "Aucun appareil Cast ne répond à cette adresse." };
    }
    return { success: true, device: discovery.addManual(ip) };
  }

  return {
    discover: () => discovery.start(),
    addHost,
    start,
    control,
    stop: () => end("stop"),
    diagnostics: async (): Promise<Diagnostics & { firewall: FirewallStatus | null }> => ({
      ...discovery.diagnostics(),
      firewall: await firewall(),
    }),
    shutdown: () => {
      end("shutdown");
      discovery.stop();
    },
  };
}

export type Cast = ReturnType<typeof createCast>;
