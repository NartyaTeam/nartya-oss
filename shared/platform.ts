import type { DownloadItem, DownloadOutcome, DownloadRequest } from "./downloads.ts";

export type OsPlatform = "darwin" | "win32" | "linux";

export type AppInfo = {
  version: string;
  platform: OsPlatform;
};

export type Channel =
  | "app-info"
  | "auth-redirect-url"
  | "auth-open"
  | "auth-await-callback"
  | "auth-captcha"
  | "auth-cancel"
  | "stream-session"
  | "stream-resolve"
  | "downloads-list"
  | "downloads-start"
  | "downloads-cancel"
  | "downloads-cancel-season"
  | "downloads-remove"
  | "downloads-local-url"
  | "downloads-open-folder"
  | "downloads-changed";

// Sign in happens in the system browser, so the app never sees the provider's page. The
// redirect lands on a loopback server the main process owns, which hands back the url.
export type AuthBridge = {
  redirectUrl: () => Promise<string | null>;
  open: (url: string) => Promise<boolean>;
  awaitCallback: () => Promise<string | null>;
  // Cloudflare refuses a file:// origin, so the page carrying the widget is served by the
  // same loopback server and opened in the browser, where 127.0.0.1 can be allowed.
  captchaToken: (siteKey: string) => Promise<string | null>;
  cancel: () => Promise<void>;
};

// The main process holds the api address, so the renderer hands over the session token
// and never the destination it travels to.
export type StreamBridge = {
  session: (accessToken: string | null) => Promise<void>;
  resolve: (token: string, forceRefresh?: boolean) => Promise<StreamOutcome>;
};

export type StreamOutcome =
  { ok: true; url: string; isHls: boolean } | { ok: false; error: string };

export type DownloadsBridge = {
  list: () => Promise<DownloadItem[]>;
  start: (request: DownloadRequest) => Promise<DownloadOutcome>;
  cancel: (id: string) => Promise<void>;
  cancelSeason: (slug: string, seasonId: string, lang: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  // Null when the file is gone: a record can outlive the folder someone emptied by hand.
  localUrl: (id: string, file: string) => Promise<string | null>;
  openFolder: () => Promise<void>;
  onChange: (listener: (item: DownloadItem) => void) => () => void;
};

export type Platform = {
  getAppInfo: () => Promise<AppInfo>;
  auth: AuthBridge;
  stream: StreamBridge;
  downloads: DownloadsBridge;
};
