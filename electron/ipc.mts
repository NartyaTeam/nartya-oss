import { app, ipcMain, shell, type IpcMainInvokeEvent } from "electron";
import type { AppInfo, Channel, OsPlatform } from "../shared/platform.ts";
import { createAuth, type Auth } from "./auth.mts";

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

export function registerPlatformHandlers(isAppUrl: IsAppUrl): void {
  secureHandle("app-info", isAppUrl, (): AppInfo => ({
    version: app.getVersion(),
    platform: osPlatform(),
  }));
  registerAuthHandlers(isAppUrl, createAuth({ openUrl: (url) => shell.openExternal(url) }));
}

export function registerAuthHandlers(isAppUrl: IsAppUrl, auth: Auth): void {
  secureHandle("auth-redirect-url", isAppUrl, () => auth.redirectUrl());
  secureHandle("auth-open", isAppUrl, (url) => auth.open(url));
  secureHandle("auth-await-callback", isAppUrl, () => auth.awaitCallback());
  secureHandle("auth-captcha", isAppUrl, (siteKey) => auth.captchaToken(siteKey));
  secureHandle("auth-cancel", isAppUrl, () => auth.cancel());
}
