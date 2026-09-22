import assert from "node:assert/strict";
import { test } from "node:test";
import { createCast, type CastParts, type CastState } from "./cast.mts";
import type { CastHandlers, CastSession, CastStatus } from "./cast-session.mts";
import type { Device } from "./cast-registry.mts";
import type { FirewallStatus } from "./firewall.mts";

const DEVICE_IP = "192.168.1.42";
const DEVICE_ID = `manual:${DEVICE_IP}`;

type Recorded = {
  states: CastState[];
  devices: Device[][];
  listenerStops: number;
  calls: string[];
  handlers: CastHandlers | null;
  asked: { url: string; port: number; tokenStillValid: boolean } | null;
  order: string[];
  liveToken: string | null;
  session: CastSession;
  flags: { ready: boolean };
};

function harness(overrides: Partial<CastParts> = {}) {
  const calls: string[] = [];
  const flags = { ready: true };

  const session: CastSession = {
    play: async () => void calls.push("play"),
    pause: async () => void calls.push("pause"),
    seek: async (seconds: number) => void calls.push(`seek ${seconds}`),
    setVolume: async (level: number) => void calls.push(`volume ${level}`),
    setMuted: async (muted: boolean) => void calls.push(`mute ${muted}`),
    close: () => void calls.push("close"),
    get ready() {
      return flags.ready;
    },
  };

  const recorded: Recorded = {
    states: [],
    devices: [],
    listenerStops: 0,
    calls,
    handlers: null,
    asked: null,
    order: [],
    liveToken: "lan-token",
    flags,
    session,
  };

  const parts: CastParts = {
    castUrl: async (url) => {
      recorded.order.push("castUrl");
      // The real one opens the lan listener, which mints a token when it was closed.
      recorded.liveToken ??= `lan-${recorded.order.length}`;
      return `http://192.168.1.10:9000/video/proxy?t=${recorded.liveToken}&from=${encodeURIComponent(url)}`;
    },
    stopCastListener: () => {
      recorded.order.push("stopListener");
      recorded.listenerStops += 1;
      recorded.liveToken = null;
    },
    lastCastRequestFrom: () => 0,
    onDevices: (devices) => recorded.devices.push(devices),
    onStatus: (state) => recorded.states.push(state),
    probe: async () => true,
    firewall: async () => null,
    openSession: async (device, requested, handlers) => {
      recorded.order.push("openSession");
      recorded.handlers = handlers;
      const token = new URL(requested.url).searchParams.get("t");
      recorded.asked = {
        url: requested.url,
        port: device.port,
        tokenStillValid: token === recorded.liveToken,
      };
      return recorded.session;
    },
    ...overrides,
  };

  return { cast: createCast(parts), recorded };
}

const media = { url: "http://127.0.0.1:8000/video/proxy?h=abc&t=local" };

async function withDevice(overrides: Partial<CastParts> = {}) {
  const { cast, recorded } = harness(overrides);
  const added = await cast.addHost(DEVICE_IP);
  assert.equal(added.success, true);
  return { cast, recorded };
}

test("refuses an address that is not on a local network, or with nothing answering", async () => {
  const { cast } = harness({ probe: async () => false });
  assert.match((await cast.addHost("8.8.8.8")).error ?? "", /IP locale invalide/);
  assert.match((await cast.addHost("192.168.1.7")).error ?? "", /Aucun appareil Cast/);
});

test("refuses to start on an unknown device or with no video", async () => {
  const { cast } = await withDevice();
  assert.match((await cast.start("nope", media)).error ?? "", /Appareil introuvable/);
  assert.match((await cast.start(DEVICE_ID, { url: "" })).error ?? "", /Aucune vidéo/);
});

test("a video the proxy will not translate cannot be cast", async () => {
  const { cast } = await withDevice({ castUrl: async () => null });
  const result = await cast.start(DEVICE_ID, media);
  assert.deepEqual(result, {
    success: false,
    error: "Cette vidéo ne peut pas être castée.",
    mediaFailed: true,
  });
});

test("hands the device the translated url and names the device in every status", async () => {
  const { cast, recorded } = await withDevice({
    castUrl: async (url) => {
      assert.equal(url, media.url);
      return "http://192.168.1.10:9000/video/proxy?h=abc&t=lan";
    },
  });

  assert.deepEqual(await cast.start(DEVICE_ID, media), { success: true });
  assert.equal(recorded.asked?.url, "http://192.168.1.10:9000/video/proxy?h=abc&t=lan");
  assert.equal(recorded.asked?.port, 8009);

  recorded.handlers?.onStatus({ ...blank, playerState: "PLAYING", currentTime: 12 });
  assert.deepEqual(recorded.states.at(-1), {
    ...blank,
    playerState: "PLAYING",
    currentTime: 12,
    deviceId: DEVICE_ID,
    deviceName: `Appareil ${DEVICE_IP}`,
  });
});

test("controls reach the session, and the volume is kept inside its range", async () => {
  const { cast, recorded } = await withDevice();
  await cast.start(DEVICE_ID, media);

  assert.deepEqual(await cast.control("play"), { success: true });
  await cast.control("pause");
  await cast.control("seek", 42);
  await cast.control("volume", 3);
  await cast.control("volume", undefined);
  await cast.control("mute", true);
  assert.deepEqual(recorded.calls, [
    "play",
    "pause",
    "seek 42",
    "volume 1",
    "volume 0",
    "mute true",
  ]);
});

test("waits for the media session before play, pause or seek", async () => {
  const { cast, recorded } = await withDevice();
  await cast.start(DEVICE_ID, media);
  recorded.flags.ready = false;

  assert.match((await cast.control("play")).error ?? "", /pas encore prête/);
  assert.match((await cast.control("seek", 5)).error ?? "", /pas encore prête/);
  assert.deepEqual(await cast.control("volume", 0.5), { success: true });
  assert.deepEqual(recorded.calls, ["volume 0.5"]);
});

test("a control that the device refuses comes back with its message", async () => {
  const { cast, recorded } = await withDevice();
  await cast.start(DEVICE_ID, media);
  recorded.session.seek = () => Promise.reject(new Error("INVALID_REQUEST"));

  assert.deepEqual(await cast.control("seek", 5), { success: false, error: "INVALID_REQUEST" });
});

test("nothing to control once the session is gone", async () => {
  const { cast, recorded } = await withDevice();
  await cast.start(DEVICE_ID, media);

  assert.deepEqual(await cast.control("stop"), { success: true });
  assert.deepEqual(recorded.calls, ["close"]);
  assert.equal(recorded.listenerStops, 1);
  assert.deepEqual(recorded.states.at(-1), {
    ...blank,
    deviceId: null,
    deviceName: null,
    ended: true,
    reason: "stop",
  });
  assert.match((await cast.control("play")).error ?? "", /Aucun cast actif/);
});

test("the device closing the connection ends the session", async () => {
  const { cast, recorded } = await withDevice();
  await cast.start(DEVICE_ID, media);

  recorded.handlers?.onClosed("device-closed");
  assert.equal(recorded.listenerStops, 1);
  assert.equal(recorded.states.at(-1)?.reason, "device-closed");
  assert.match((await cast.control("pause")).error ?? "", /Aucun cast actif/);
});

test("switching device ends the first session before minting the new url", async () => {
  const { cast, recorded } = await withDevice();
  await cast.start(DEVICE_ID, media);
  recorded.order.length = 0;
  await cast.start(DEVICE_ID, media);

  assert.deepEqual(recorded.calls, ["close"]);
  assert.equal(
    recorded.states.some((state) => state.reason === "switch"),
    true,
  );
  // Stopping the listener drops its token, so a url minted before that is already dead.
  assert.deepEqual(recorded.order, ["stopListener", "castUrl", "openSession"]);
  assert.equal(recorded.asked?.tokenStillValid, true);
});

test("a device that hangs up while loading leaves no half open session", async () => {
  let closes = 0;
  const { cast, recorded } = await withDevice({
    openSession: async (_device, _media, handlers) => {
      handlers.onClosed("device-closed");
      return {
        play: async () => {},
        pause: async () => {},
        seek: async () => {},
        setVolume: async () => {},
        setMuted: async () => {},
        close: () => {
          closes += 1;
        },
        ready: true,
      };
    },
  });

  const result = await cast.start(DEVICE_ID, media);
  assert.equal(result.success, false);
  assert.equal(closes, 1);
  assert.equal(recorded.states.at(-1)?.reason, "device-closed");
  assert.match((await cast.control("play")).error ?? "", /Aucun cast actif/);
});

test("an unreachable device is explained by the network, and leaves nothing behind", async () => {
  const { cast, recorded } = await withDevice({
    openSession: () =>
      Promise.reject(Object.assign(new Error("ECONNREFUSED"), { stage: "connect" })),
  });

  const result = await cast.start(DEVICE_ID, media);
  assert.equal(result.success, false);
  assert.match(result.error ?? "", /même réseau/);
  assert.equal(recorded.listenerStops, 1);
  assert.match((await cast.control("play")).error ?? "", /Aucun cast actif/);
});

test("a load nobody came for reads the firewall, a load that was fetched does not", async () => {
  const blocked: FirewallStatus = { blocked: true, publicNetwork: false, allowedOnNetwork: false };
  let reads = 0;
  const failing = {
    openSession: () => Promise.reject(Object.assign(new Error("load failed"), { stage: "load" })),
    firewall: async () => {
      reads += 1;
      return blocked;
    },
  };

  const quiet = await withDevice({ ...failing, lastCastRequestFrom: () => 0 });
  assert.match((await quiet.cast.start(DEVICE_ID, media)).error ?? "", /pare-feu Windows/);
  assert.equal(reads, 1);

  const fetched = await withDevice({ ...failing, lastCastRequestFrom: () => Date.now() + 1_000 });
  const result = await fetched.cast.start(DEVICE_ID, media);
  assert.equal(result.mediaFailed, true);
  assert.equal(reads, 1);
});

test("diagnostics carry the discovery counters and the firewall", async () => {
  const { cast } = await withDevice();
  const report = await cast.diagnostics();
  assert.equal(report.discovering, false);
  assert.equal(report.devices, 1);
  assert.equal(report.firewall, null);
});

const blank: CastStatus = {
  playerState: null,
  idleReason: null,
  currentTime: null,
  duration: null,
  volume: null,
  muted: null,
};
