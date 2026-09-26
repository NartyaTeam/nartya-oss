import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { readApiBase } from "./api-base.mts";
import { appUrlCheck, resolveTarget } from "./app-url.mts";
import { createDeepLinks, DEEP_LINK_SCHEME, linkIn } from "./deep-link.mts";
import { isolateDevData } from "./dev-data.mts";
import { registerPlatformHandlers, secureHandle } from "./ipc.mts";
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

// A development build would take the links away from the installed app.
if (app.isPackaged) app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME);

const links = createDeepLinks();
function receive(link: string | null): void {
  if (!link || !links.receive(link)) return;
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && isAppUrl(window.webContents.getURL())) {
      window.webContents.send("navigation-pending");
    }
  }
}
// On Windows and Linux a link launching the app arrives as an argument.
receive(linkIn(process.argv));

const flush = registerPlatformHandlers(isAppUrl, readApiBase(here));
secureHandle("navigation-take", isAppUrl, () => links.take());
app.on("before-quit", flush);

app.on("second-instance", (_event, argv) => {
  receive(linkIn(argv));
  const [window] = BrowserWindow.getAllWindows();
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.focus();
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  receive(url);
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
