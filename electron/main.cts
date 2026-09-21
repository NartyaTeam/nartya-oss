import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import type { AppInfo, OsPlatform } from "../shared/platform";

const devServerUrl = process.env["VITE_DEV_SERVER_URL"];

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());

  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(join(__dirname, "../../dist/index.html"));
  }
}

function osPlatform(): OsPlatform {
  if (process.platform === "darwin" || process.platform === "win32") return process.platform;
  return "linux";
}

ipcMain.handle("app-info", (): AppInfo => ({ version: app.getVersion(), platform: osPlatform() }));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [window] = BrowserWindow.getAllWindows();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  void app.whenReady().then(createWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
