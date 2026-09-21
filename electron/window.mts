import { BrowserWindow, shell } from "electron";
import { isHttpUrl, type AppUrlTarget } from "./app-url.mts";
import type { IsAppUrl } from "./ipc.mts";

const MIN_WIDTH = 1024;
const MIN_HEIGHT = 640;

export type WindowOptions = {
  preload: string;
  target: AppUrlTarget;
  isAppUrl: IsAppUrl;
};

export function createWindow({ preload, target, isAppUrl }: WindowOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 880,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    backgroundColor: "#0b0b0f",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // Automatic resizing on HTML5 fullscreen is unreliable under fractional scaling.
      disableHtmlFullscreenWindowResize: true,
      // Without this the video stutters as soon as the window loses focus.
      backgroundThrottling: false,
    },
  });

  window.webContents.on("enter-html-full-screen", () => {
    // At high scaling the screen can be narrower than the minimum size in DIP.
    window.setMinimumSize(0, 0);
    if (!window.isFullScreen()) window.setFullScreen(true);
  });
  window.webContents.on("leave-html-full-screen", () => {
    if (window.isFullScreen()) window.setFullScreen(false);
    window.setMinimumSize(MIN_WIDTH, MIN_HEIGHT);
  });

  // The window exposes the platform bridge, so it must never show anything but the app.
  window.webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    if (isHttpUrl(url)) void shell.openExternal(url);
  });
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  if ("devUrl" in target) void window.loadURL(target.devUrl);
  else void window.loadFile(target.file);

  return window;
}

export function revealOnce(window: BrowserWindow): void {
  let shown = false;
  const reveal = () => {
    if (shown || window.isDestroyed()) return;
    shown = true;
    window.show();
  };
  // ready-to-show does not always fire under ChromeOS, hence the second net.
  window.once("ready-to-show", reveal);
  window.webContents.once("did-finish-load", reveal);
}
