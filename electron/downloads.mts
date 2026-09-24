import { rm } from "node:fs/promises";
import type { DownloadItem } from "../shared/downloads.ts";
import { createEntries } from "./download-entry.mts";
import { downloadHls } from "./download-hls.mts";
import { downloadMp4 } from "./download-mp4.mts";
import { itemFolder, isValidId } from "./download-paths.mts";
import { downloadScanChapter } from "./download-scans.mts";
import type { Fetch } from "./download-file.mts";
import type { ItemStore } from "./download-store.mts";
import { friendlyErrorMessage } from "./friendly-error.mts";
import { createLogger } from "./log.mts";

export type Pending = { id: string; url?: string; provider?: string | null; maxHeight?: number };

export type Parts = {
  store: ItemStore;
  root: () => string;
  fetch: Fetch;
  ffmpeg: () => Promise<string | null>;
  onChange: (item: DownloadItem) => void;
  resolveHandle: (handle: string) => { url: string; provider: string | null } | null;
  trustedScanBase: (imageBase: string) => boolean;
};

export type Result = { success: boolean; error?: string; canceled?: number };

const log = createLogger("downloads");
const DEFAULT_CONCURRENT = 2;

export function createDownloads(parts: Parts) {
  const { store, root, fetch, ffmpeg, onChange, resolveHandle, trustedScanBase } = parts;
  const active = new Map<string, AbortController>();
  const queue: Pending[] = [];
  let running = 0;
  let maxConcurrent = DEFAULT_CONCURRENT;

  // Nothing runs yet at this point: whatever says otherwise was cut short by a crash.
  for (const [id, item] of Object.entries(store.all())) {
    if (item.status === "queued" || item.status === "downloading" || item.status === "processing") {
      store.set(id, { status: "error", error: "Interrompu" });
    }
  }

  function emit(id: string): void {
    const item = store.get(id);
    if (item) onChange(item);
  }

  // Writing to an id that is gone would recreate a record with no title, pointing at a
  // folder that was deleted. Every write during a download goes through here.
  function update(id: string, patch: Partial<DownloadItem>, now = false): boolean {
    if (!store.get(id)) return false;
    store.set(id, patch, { now });
    emit(id);
    return true;
  }

  function progress(id: string, percent: number, sizeBytes: number): void {
    update(id, { status: "downloading", percent, sizeBytes });
  }

  async function run(pending: Pending): Promise<void> {
    const { id } = pending;
    const controller = new AbortController();
    active.set(id, controller);

    try {
      const item = store.get(id);
      if (!item) return;
      update(id, { status: "downloading", percent: 0 });
      const dir = itemFolder(root(), id);
      let file: string | undefined;
      let sizeBytes: number;

      if (item.type === "scan") {
        sizeBytes = await downloadScanChapter(fetch, {
          imageBase: item.imageBase,
          oeuvre: item.oeuvre,
          folder: item.folder,
          pages: item.pages,
          dir,
          signal: controller.signal,
          onProgress: (done, total, bytes) => progress(id, (done / total) * 100, bytes),
        });
      } else if (/\.m3u8(\?|$)/i.test(pending.url ?? "")) {
        const result = await downloadHls(
          fetch,
          {
            url: pending.url ?? "",
            provider: pending.provider ?? null,
            dir,
            maxHeight: pending.maxHeight ?? Infinity,
            signal: controller.signal,
            onProgress: (done, total, bytes) => progress(id, (done / total) * 100, bytes),
            onRemux: () => update(id, { status: "processing", percent: 99 }),
          },
          await ffmpeg(),
        );
        file = result.file;
        sizeBytes = result.sizeBytes;
      } else {
        sizeBytes = await downloadMp4(fetch, {
          url: pending.url ?? "",
          provider: pending.provider ?? null,
          dest: `${dir}/video.mp4`,
          signal: controller.signal,
          onProgress: (received, total) =>
            progress(id, total ? (received / total) * 100 : 0, received),
        });
        file = "video.mp4";
      }

      update(id, { status: "done", percent: 100, file, sizeBytes, finishedAt: Date.now() }, true);
      log.info("done", { id, file, sizeBytes });
    } catch (error) {
      if (controller.signal.aborted) {
        await remove(id).catch(() => {});
        return;
      }
      // The technical detail stays in the log: the interface never shows a raw node error.
      log.warn("failed", { id, err: error });
      update(id, { status: "error", error: friendlyErrorMessage(error) }, true);
    } finally {
      active.delete(id);
      running--;
      void next();
    }
  }

  async function next(): Promise<void> {
    if (running >= maxConcurrent) return;
    const pending = queue.shift();
    if (!pending) return;
    // Cancelled while it waited: reviving it would write a record with no title at all.
    if (!store.get(pending.id)) return next();
    running++;
    await run(pending);
  }

  function enqueue(pending: Pending): void {
    queue.push(pending);
    void next();
  }

  async function remove(id: string): Promise<Result> {
    if (!isValidId(id)) return { success: false, error: "Identifiant invalide" };
    active.get(id)?.abort();
    const waiting = queue.findIndex((pending) => pending.id === id);
    if (waiting !== -1) queue.splice(waiting, 1);

    await rm(itemFolder(root(), id), { recursive: true, force: true }).catch(() => {});
    store.remove(id);
    return { success: true };
  }

  async function cancel(id: string): Promise<Result> {
    if (!isValidId(id)) return { success: false, error: "Identifiant invalide" };
    const controller = active.get(id);
    // The files and the record go in run()'s catch, once it has actually stopped: doing it
    // here too would race with writes still in flight.
    if (controller) {
      controller.abort();
      return { success: true };
    }

    const waiting = queue.findIndex((pending) => pending.id === id);
    if (waiting !== -1) {
      queue.splice(waiting, 1);
      return remove(id);
    }

    // Neither running nor queued: cancelling must still make a stuck entry disappear.
    const status = store.get(id)?.status;
    if (status === "downloading" || status === "queued") return remove(id);
    return { success: true };
  }

  // Matches on the id prefix rather than a list from the renderer, which only knows what
  // it queued itself, not what a previous session left behind.
  async function cancelMatching(prefix: string, suffix: string | null): Promise<Result> {
    const matches = (id: string) => id.startsWith(prefix) && (!suffix || id.endsWith(suffix));

    // Emptied before aborting anything: each abort calls next(), which would otherwise
    // start the very episode being cancelled.
    for (let index = queue.length - 1; index >= 0; index--) {
      if (matches(queue[index]?.id ?? "")) queue.splice(index, 1);
    }

    const ids = Object.keys(store.all()).filter((id) => {
      if (!matches(id)) return false;
      const status = store.get(id)?.status;
      return status === "queued" || status === "downloading";
    });
    // What is already done is spared: cancelling a season does not erase what was earned.
    for (const id of ids) await remove(id).catch(() => {});

    log.info("batch cancelled", { prefix, count: ids.length });
    return { success: true, canceled: ids.length };
  }

  function list(): DownloadItem[] {
    // A record with no slug would break the offline library on render.
    return Object.entries(store.all())
      .map(([id, item]) => ({ ...item, id }))
      .filter((item) => Boolean(item.slug));
  }

  const entries = createEntries({
    store,
    root,
    fetch,
    emit,
    enqueue,
    resolveHandle,
    trustedScanBase,
  });

  return {
    start: entries.start,
    startScan: entries.startScan,
    enqueue,
    cancel,
    cancelMatching,
    remove,
    list,
    setMaxConcurrent(value: number) {
      maxConcurrent = Math.max(1, Math.floor(value) || DEFAULT_CONCURRENT);
      void next();
    },
    isBusy: () => active.size > 0 || queue.length > 0,
    flush: () => store.flush(),
  };
}

export type Downloads = ReturnType<typeof createDownloads>;
