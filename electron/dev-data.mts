import { join } from "node:path";
import { app } from "electron";

// Unpackaged, the app carries the installed Nartya's name, and with it that app's data
// folder: its downloads, its index, its caches. Development gets a folder of its own.
export function isolateDevData(): void {
  if (!app.isPackaged) app.setPath("userData", join(app.getPath("appData"), "nartya-dev"));
}
