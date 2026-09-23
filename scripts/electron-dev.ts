import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "vite";

// Required from node, the electron package exports the path to its binary.
const electronPath: unknown = createRequire(import.meta.url)("electron");
if (typeof electronPath !== "string") throw new Error("electron-dev: electron binary not found");

const server = await createServer();
await server.listen();
const devUrl = server.resolvedUrls?.local[0];
if (!devUrl) throw new Error("electron-dev: vite reported no local url");

const electron = spawn(electronPath, ["."], {
  stdio: "inherit",
  env: { ...process.env, VITE_DEV_SERVER_URL: devUrl },
});

electron.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
