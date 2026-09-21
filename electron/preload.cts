import { contextBridge, ipcRenderer } from "electron";
import type { Channel, Platform } from "../shared/platform";

function invoke<T>(channel: Channel): Promise<T> {
  return ipcRenderer.invoke(channel);
}

const platform: Platform = {
  getAppInfo: () => invoke("app-info"),
};

contextBridge.exposeInMainWorld("platform", platform);
