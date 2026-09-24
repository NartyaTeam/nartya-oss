import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow, shell } from "electron";
import {
  downloadId,
  seasonPrefix,
  type DownloadItem,
  type DownloadOutcome,
} from "../shared/downloads.ts";
import type { Channel } from "../shared/platform.ts";
import { readDownloadRequest, readSeason } from "./download-request.mts";
import { resolveLocalFile } from "./download-paths.mts";
import { createItemStore } from "./download-store.mts";
import { createDownloads } from "./downloads.mts";
import { findFfmpeg } from "./ffmpeg.mts";
import { createLogger } from "./log.mts";
import { fetchFromProvider } from "./provider-fetch.mts";
import { localProxy, serveDownloads } from "./proxy.mts";
import { streamHandles } from "./stream-handles.mts";
import type { Streams } from "./stream.mts";

const log = createLogger("downloads-ipc");

type Reply = (argument: unknown) => unknown;

// Only to the app's own pages, like the calls: a stray page has no business seeing the library.
function broadcast(item: DownloadItem, isAppUrl: (url: string) => boolean): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed() || !isAppUrl(window.webContents.getURL())) continue;
    window.webContents.send("downloads-changed", item);
  }
}

export function createDownloadHandlers(streams: Streams, isAppUrl: (url: string) => boolean) {
  const root = join(app.getPath("userData"), "downloads");
  mkdirSync(root, { recursive: true });
  serveDownloads(root);

  const downloads = createDownloads({
    store: createItemStore(join(app.getPath("userData"), "downloads.json")),
    root: () => root,
    fetch: (url, { provider, rangeHeader, signal }) =>
      fetchFromProvider(url, { provider, rangeHeader, signal }),
    ffmpeg: findFfmpeg,
    onChange: (item) => broadcast(item, isAppUrl),
    resolveHandle: (handle) => streamHandles.resolve(handle),
    // Scans are not part of this app yet: no page base is trusted.
    trustedScanBase: () => false,
  });

  const id = (value: unknown): string => (typeof value === "string" ? value : "");

  const start = async (argument: unknown): Promise<DownloadOutcome> => {
    const request = readDownloadRequest(argument);
    if (!request) return { ok: false, error: "Épisode invalide" };

    const resolved = await streams.resolve(request.token, false);
    if (!resolved.ok) return { ok: false, error: resolved.error };

    const started = await downloads.start({
      ...request,
      id: downloadId(request.slug, request.seasonId, request.ep, request.lang),
      handle: resolved.value.handle,
    });
    if (!started.success) log.warn("start refused", { error: started.error });
    return started.success ? { ok: true } : { ok: false, error: started.error ?? "Échec" };
  };

  const handlers: [Channel, Reply][] = [
    ["downloads-list", () => downloads.list()],
    ["downloads-start", start],
    [
      "downloads-cancel",
      async (value) => {
        await downloads.cancel(id(value));
      },
    ],
    [
      "downloads-cancel-season",
      async (value) => {
        const season = readSeason(value);
        if (season) {
          await downloads.cancelMatching(
            seasonPrefix(season.slug, season.seasonId),
            `::${season.lang}`,
          );
        }
      },
    ],
    [
      "downloads-remove",
      async (value) => {
        await downloads.remove(id(value));
      },
    ],
    [
      "downloads-local-url",
      async (value) => {
        const { id: entry, file } = (value ?? {}) as { id?: unknown; file?: unknown };
        const rel = typeof file === "string" && file ? file : "video.mp4";
        if (!resolveLocalFile(root, id(entry), rel)) return null;
        await localProxy.start();
        return localProxy.localFileUrl(id(entry), rel);
      },
    ],
    [
      "downloads-open-folder",
      async () => {
        const failure = await shell.openPath(root);
        if (failure) log.warn("folder did not open", { failure });
      },
    ],
  ];

  return { handlers, flush: () => downloads.flush() };
}
