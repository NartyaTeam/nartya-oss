import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export type AppUrlTarget = { devUrl: string } | { file: string };

export function appUrlCheck(target: AppUrlTarget): (url: string) => boolean {
  if ("devUrl" in target) return (url) => url.startsWith(target.devUrl);

  // Resolved on both sides: a relative or drive relative target would never match.
  const expected = resolve(target.file);

  return (url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "file:") return false;
      const file = fileURLToPath(parsed);
      // Compared as paths, not strings: an accented install path or a Windows drive
      // letter can be encoded or cased differently by Chromium.
      return process.platform === "win32"
        ? file.toLowerCase() === expected.toLowerCase()
        : file === expected;
    } catch {
      return false;
    }
  };
}

export function resolveTarget(here: string): AppUrlTarget {
  const devServerUrl = process.env["VITE_DEV_SERVER_URL"];
  return devServerUrl ? { devUrl: devServerUrl } : { file: join(here, "../../dist/index.html") };
}
