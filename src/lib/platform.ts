import type { Platform } from "../../shared/platform";

declare global {
  interface Window {
    platform?: Platform;
  }
}

export function getPlatform(): Platform | null {
  return window.platform ?? null;
}
