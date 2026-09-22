export type OsPlatform = "darwin" | "win32" | "linux";

export type AppInfo = {
  version: string;
  platform: OsPlatform;
};

export type Channel =
  "app-info" | "auth-redirect-url" | "auth-open" | "auth-await-callback" | "auth-cancel";

// Sign in happens in the system browser, so the app never sees the provider's page. The
// redirect lands on a loopback server the main process owns, which hands back the url.
export type AuthBridge = {
  redirectUrl: () => Promise<string | null>;
  open: (url: string) => Promise<boolean>;
  awaitCallback: () => Promise<string | null>;
  cancel: () => Promise<void>;
};

export type Platform = {
  getAppInfo: () => Promise<AppInfo>;
  auth: AuthBridge;
};
