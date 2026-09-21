import { contextBridge, ipcRenderer } from "electron";
import type { Platform } from "../shared/platform";

const platform: Platform = {
  getAppInfo: () => ipcRenderer.invoke("app-info"),
};

contextBridge.exposeInMainWorld("platform", platform);
