import { contextBridge, ipcRenderer } from "electron";
import type { DownloadItem } from "../shared/downloads.ts";
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
  downloads: {
    list: () => invoke("downloads-list"),
    start: (request) => invoke("downloads-start", request),
    cancel: (id) => invoke("downloads-cancel", id),
    cancelSeason: (slug, seasonId, lang) =>
      invoke("downloads-cancel-season", { slug, seasonId, lang }),
    remove: (id) => invoke("downloads-remove", id),
    localUrl: (id, file) => invoke("downloads-local-url", { id, file }),
    openFolder: () => invoke("downloads-open-folder"),
    setSlots: (count) => invoke("downloads-set-slots", count),
    onChange: (listener) => {
      const relay = (_event: unknown, id: string, item: DownloadItem | null): void =>
        listener(id, item);
      ipcRenderer.on("downloads-changed", relay);
      return () => ipcRenderer.removeListener("downloads-changed", relay);
    },
  },
};

contextBridge.exposeInMainWorld("platform", platform);
