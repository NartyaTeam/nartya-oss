export type OsPlatform = "darwin" | "win32" | "linux";

export type AppInfo = {
  version: string;
  platform: OsPlatform;
};

export type Platform = {
  getAppInfo: () => Promise<AppInfo>;
};
