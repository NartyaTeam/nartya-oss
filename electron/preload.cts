import { contextBridge, ipcRenderer } from "electron";
import type { Channel, Platform } from "../shared/platform.ts";

function invoke<T>(channel: Channel, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args);
}

const platform: Platform = {
  getAppInfo: () => invoke("app-info"),
  auth: {
    redirectUrl: () => invoke("auth-redirect-url"),
    open: (url) => invoke("auth-open", url),
    awaitCallback: () => invoke("auth-await-callback"),
    captchaToken: (siteKey) => invoke("auth-captcha", siteKey),
    cancel: () => invoke("auth-cancel"),
  },
  stream: {
    session: (accessToken) => invoke("stream-session", accessToken),
    resolve: (token, forceRefresh) => invoke("stream-resolve", { token, forceRefresh }),
  },
};

contextBridge.exposeInMainWorld("platform", platform);
