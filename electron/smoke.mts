import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { appUrlCheck, resolveTarget } from "./app-url.mts";
import { registerPlatformHandlers } from "./ipc.mts";

const here = import.meta.dirname;
const target = resolveTarget(here);

function fail(reason: string): never {
  console.error(`smoke: ${reason}`);
  app.exit(1);
  throw new Error(reason);
}

async function run(): Promise<void> {
  registerPlatformHandlers(appUrlCheck(target), null);

  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if ("devUrl" in target) await window.loadURL(target.devUrl);
  else await window.loadFile(target.file);

  const info: unknown = await window.webContents
    .executeJavaScript("window.platform && window.platform.getAppInfo()")
    .catch((error: unknown) => fail(`bridge call rejected: ${String(error)}`));

  if (typeof info !== "object" || info === null) fail(`expected an object, got ${typeof info}`);
  const { version, platform } = info as Record<string, unknown>;
  if (typeof version !== "string" || version.length === 0) fail("missing version");
  if (platform !== "darwin" && platform !== "win32" && platform !== "linux") {
    fail(`unexpected platform ${String(platform)}`);
  }

  const redirect: unknown = await window.webContents
    .executeJavaScript("window.platform.auth.redirectUrl()")
    .catch((error: unknown) => fail(`auth bridge rejected: ${String(error)}`));
  if (typeof redirect !== "string" || !redirect.startsWith("http://127.0.0.1:")) {
    fail(`expected a loopback redirect, got ${String(redirect)}`);
  }

  const opened: unknown = await window.webContents.executeJavaScript(
    'window.platform.auth.open("file:///etc/passwd")',
  );
  if (opened !== false) fail("the bridge opened something that is not https");
  await window.webContents.executeJavaScript("window.platform.auth.cancel()");

  // No api address in a source checkout, so resolving must refuse rather than reach out.
  await window.webContents.executeJavaScript("window.platform.stream.session('a-token')");
  const stream: unknown = await window.webContents
    .executeJavaScript('window.platform.stream.resolve("some-token")')
    .catch((error: unknown) => fail(`stream bridge rejected: ${String(error)}`));
  const outcome = stream as { ok?: unknown; error?: unknown };
  if (outcome.ok !== false || typeof outcome.error !== "string") {
    fail(`expected a refusal without an api, got ${JSON.stringify(stream)}`);
  }

  const intruder = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  await intruder.loadURL("data:text/html,<title>not the app</title>");

  const rejected = await intruder.webContents
    .executeJavaScript("window.platform.getAppInfo()")
    .then(() => false)
    .catch(() => true);
  if (!rejected) fail("a page that is not the app reached the bridge");

  console.log(
    `smoke: bridge answered version ${version} on ${platform}, served ${redirect}, ` +
      `refused a file url and a foreign page, and playback without an api (${String(outcome.error)})`,
  );
  app.exit(0);
}

// Not a top level await: Electron only emits ready once the entry module has finished
// evaluating, so awaiting whenReady at module scope deadlocks.
void app.whenReady().then(run);
