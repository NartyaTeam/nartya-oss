import { copyFile } from "node:fs/promises";

// The api address belongs to a build, not to the source. Written here by whoever packages
// the app; absent, the app runs on the demo recipe.
const from = "electron/build-config.json";
const to = "dist-electron/electron/build-config.json";

await copyFile(from, to).catch(() => {
  console.log("build-config: none, the build carries no api address");
});
