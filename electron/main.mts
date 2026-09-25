import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { readApiBase } from "./api-base.mts";
import { appUrlCheck, resolveTarget } from "./app-url.mts";
import { isolateDevData } from "./dev-data.mts";
import { registerPlatformHandlers } from "./ipc.mts";
import { createLogger, startFileLog } from "./log.mts";
import { createWindow, revealOnce } from "./window.mts";

const here = import.meta.dirname;
const target = resolveTarget(here);
const isAppUrl = appUrlCheck(target);
const log = createLogger("main");

function open(): void {
  revealOnce(createWindow({ preload: join(here, "preload.cjs"), target, isAppUrl }));
}

// Before the lock and the handlers: both already live in the data folder.
isolateDevData();

// exit rather than quit: quit lets the module keep running to whenReady first.
if (!app.requestSingleInstanceLock()) app.exit(0);

const flush = registerPlatformHandlers(isAppUrl, readApiBase(here));
app.on("before-quit", flush);

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

void app.whenReady().then(() => {
  const path = startFileLog(join(app.getPath("userData"), "logs"));
  log.info("started", {
    version: app.getVersion(),
    platform: process.platform,
    log: path,
    api: readApiBase(here) !== null,
  });
  open();
});
