import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { appUrlCheck, resolveTarget } from "./app-url.mts";
import { registerPlatformHandlers } from "./ipc.mts";
import { createWindow, revealOnce } from "./window.mts";

const here = import.meta.dirname;
const target = resolveTarget(here);
const isAppUrl = appUrlCheck(target);

function open(): void {
  revealOnce(createWindow({ preload: join(here, "preload.cjs"), target, isAppUrl }));
}

// exit rather than quit: quit lets the module keep running to whenReady first.
if (!app.requestSingleInstanceLock()) app.exit(0);

registerPlatformHandlers(isAppUrl);

app.on("second-instance", () => {
  const [window] = BrowserWindow.getAllWindows();
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.focus();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) open();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

void app.whenReady().then(open);
