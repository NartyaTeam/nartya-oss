import type { DownloadItem, DownloadOutcome, DownloadRequest } from "./downloads.ts";
import type { Presence } from "./presence.ts";

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
  | "downloads-set-slots"
  | "downloads-changed"
  | "navigation-take"
  | "navigation-pending"
  | "discord-start"
  | "discord-presence";

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
  // How many episodes download at once, which the offer decides.
  setSlots: (count: number) => Promise<void>;
  // An item, or null once the entry is gone: cancelled, removed.
  onChange: (listener: (id: string, item: DownloadItem | null) => void) => () => void;
};

// A nartya:// link opened from outside. The route waits in the main process until taken.
export type NavigationBridge = {
  take: () => Promise<string | null>;
  onPending: (listener: () => void) => () => void;
};

// Discord not running, or closed later, is not an error: the presence waits for it.
export type DiscordBridge = {
  start: (clientId: string) => Promise<void>;
  set: (presence: Presence | null) => Promise<void>;
};

export type Platform = {
  getAppInfo: () => Promise<AppInfo>;
  auth: AuthBridge;
  stream: StreamBridge;
  downloads: DownloadsBridge;
  navigation: NavigationBridge;
  discord: DiscordBridge;
};
