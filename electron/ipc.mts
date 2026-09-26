import { app, ipcMain, shell, type IpcMainInvokeEvent } from "electron";
import type { AppInfo, Channel, OsPlatform, StreamOutcome } from "../shared/platform.ts";
import { createAuth, type Auth } from "./auth.mts";
import { createDiscordLink, discordPipes } from "./discord.mts";
import { readPresence, toActivity } from "./discord-presence.mts";
import { createDownloadHandlers } from "./downloads-ipc.mts";
import { localProxy } from "./proxy.mts";
import { createStreams, type Streams } from "./stream.mts";

export type IsAppUrl = (url: string) => boolean;

// Only the app's own top frame may reach a handler: neither a third party page that
// managed to load in the window, nor an iframe inside it.
function isTrustedSender(event: IpcMainInvokeEvent, isAppUrl: IsAppUrl): boolean {
  const frame = event.senderFrame;
  return frame !== null && frame.parent === null && isAppUrl(frame.url);
}

export function secureHandle<T>(
  channel: Channel,
  isAppUrl: IsAppUrl,
  reply: (argument: unknown) => T,
): void {
  ipcMain.handle(channel, (event, argument: unknown) => {
    if (!isTrustedSender(event, isAppUrl)) throw new Error(`${channel}: untrusted sender`);
    return reply(argument);
  });
}

function osPlatform(): OsPlatform {
  if (process.platform === "darwin" || process.platform === "win32") return process.platform;
  return "linux";
}

export function registerStreamHandlers(isAppUrl: IsAppUrl, apiBase: string | null): Streams {
  let accessToken: string | null = null;
  const streams = createStreams(() => ({
    apiBase,
    accessToken,
    appVersion: app.getVersion(),
  }));

  secureHandle("stream-session", isAppUrl, (value) => {
    accessToken = typeof value === "string" && value ? value : null;
  });

  secureHandle("stream-resolve", isAppUrl, async (argument): Promise<StreamOutcome> => {
    const { token, forceRefresh } = (argument ?? {}) as { token?: unknown; forceRefresh?: unknown };
    if (typeof token !== "string") return { ok: false, error: "Source invalide" };

    const outcome = await streams.resolve(token, forceRefresh === true);
    if (!outcome.ok) return outcome;

    // The proxy has to be up before a handle is worth anything: it is what serves it.
    await localProxy.start();
    const url = localProxy.playbackUrl(outcome.value.handle, outcome.value.isHls);
    return url
      ? { ok: true, url, isHls: outcome.value.isHls }
      : { ok: false, error: "Proxy local indisponible" };
  });
  return streams;
}

// Returns what has to run before quitting: the download index is written on a delay.
export function registerPlatformHandlers(isAppUrl: IsAppUrl, apiBase: string | null): () => void {
  secureHandle("app-info", isAppUrl, (): AppInfo => ({
    version: app.getVersion(),
    platform: osPlatform(),
  }));
  registerAuthHandlers(isAppUrl, createAuth({ openUrl: (url) => shell.openExternal(url) }));
  const streams = registerStreamHandlers(isAppUrl, apiBase);
  const downloads = createDownloadHandlers(streams, isAppUrl);
  for (const [channel, reply] of downloads.handlers) secureHandle(channel, isAppUrl, reply);
  const discord = registerDiscordHandlers(isAppUrl);
  return () => {
    downloads.flush();
    discord.stop();
  };
}

function registerDiscordHandlers(isAppUrl: IsAppUrl) {
  const link = createDiscordLink({
    pipes: discordPipes(process.platform, process.env),
    pid: process.pid,
  });
  secureHandle("discord-start", isAppUrl, (clientId) => {
    if (typeof clientId === "string" && /^\d+$/.test(clientId)) link.start(clientId);
  });
  secureHandle("discord-presence", isAppUrl, (value) => {
    const presence = readPresence(value);
    link.set(presence ? toActivity(presence, Date.now()) : null);
  });
  return link;
}

export function registerAuthHandlers(isAppUrl: IsAppUrl, auth: Auth): void {
  secureHandle("auth-redirect-url", isAppUrl, () => auth.redirectUrl());
  secureHandle("auth-open", isAppUrl, (url) => auth.open(url));
  secureHandle("auth-await-callback", isAppUrl, () => auth.awaitCallback());
  secureHandle("auth-captcha", isAppUrl, (siteKey) => auth.captchaToken(siteKey));
  secureHandle("auth-cancel", isAppUrl, () => auth.cancel());
}
