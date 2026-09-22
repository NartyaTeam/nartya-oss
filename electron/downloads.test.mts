import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { test } from "node:test";
import type { DownloadItem } from "../shared/downloads.ts";
import type { Fetch } from "./download-file.mts";
import { itemFolder } from "./download-paths.mts";
import { createItemStore } from "./download-store.mts";
import { createDownloads } from "./downloads.mts";

// Honours the signal the way a real fetch does, or cancellation would never arrive.
function slow(ms: number): Fetch {
  return ((url: string, options: { signal: AbortSignal }) =>
    new Promise((done, failed) => {
      const timer = setTimeout(() => {
        done({
          url,
          status: 200,
          statusText: "OK",
          headers: { "content-length": "5" },
          stream: Readable.from([Buffer.from("bytes")]),
        });
      }, ms);
      options.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        failed(new DOMException("Aborted", "AbortError"));
      });
    })) as unknown as Fetch;
}

async function until(ready: () => boolean, capMs = 4_000): Promise<void> {
  const deadline = Date.now() + capMs;
  while (!ready() && Date.now() < deadline) {
    await new Promise((wait) => setTimeout(wait, 20));
  }
}

function manager(fetch: Fetch = slow(0)) {
  const root = mkdtempSync(join(tmpdir(), "nartya-dl-"));
  const store = createItemStore(join(root, "index.json"), 10_000);
  const changes: DownloadItem[] = [];
  const downloads = createDownloads({
    store,
    root: () => root,
    fetch,
    ffmpeg: () => Promise.resolve(null),
    onChange: (item) => changes.push(item),
  });
  return { root, store, downloads, changes };
}

const episode = { type: "episode", slug: "anime", status: "queued", percent: 0 } as const;

async function settle(ms = 60) {
  await new Promise((done) => setTimeout(done, ms));
}

test("runs a queued download and marks it done", async () => {
  const { store, downloads } = manager();
  store.set("a", episode);
  downloads.enqueue({ id: "a", url: "https://cdn.test/a.mp4", provider: null });
  await settle();

  assert.equal(store.get("a")?.status, "done");
  assert.equal(store.get("a")?.percent, 100);
});

test("never revives an entry deleted while it waited", async () => {
  const { store, downloads } = manager();
  downloads.enqueue({ id: "ghost", url: "https://cdn.test/a.mp4", provider: null });
  await settle();

  assert.equal(store.get("ghost"), null, "a record with no title would break the library");
});

test("holds the queue at the concurrency limit", async () => {
  const { store, downloads } = manager(slow(120));
  for (const id of ["a", "b", "c"]) {
    store.set(id, episode);
    downloads.enqueue({ id, url: "https://cdn.test/a.mp4", provider: null });
  }
  await settle(40);

  const downloading = ["a", "b", "c"].filter((id) => store.get(id)?.status === "downloading");
  assert.equal(downloading.length, 2, "two at a time by default");
});

test("cancelling drops the entry and its folder", async () => {
  const { root, store, downloads } = manager(slow(200));
  store.set("a", episode);
  downloads.enqueue({ id: "a", url: "https://cdn.test/a.mp4", provider: null });
  await settle(30);

  await downloads.cancel("a");
  await until(() => store.get("a") === null);
  assert.equal(store.get("a"), null);
  assert.equal(existsSync(itemFolder(root, "a")), false);
});

test("cancelling a season spares what is already downloaded", async () => {
  const { store, downloads } = manager(slow(200));
  store.set("anime::s1::1::vostfr", { ...episode, status: "done" });
  store.set("anime::s1::2::vostfr", episode);
  store.set("anime::s2::1::vostfr", episode);
  downloads.enqueue({ id: "anime::s1::2::vostfr", url: "https://cdn.test/a.mp4" });
  downloads.enqueue({ id: "anime::s2::1::vostfr", url: "https://cdn.test/a.mp4" });

  const result = await downloads.cancelMatching("anime::s1::", null);
  assert.equal(result.canceled, 1, "only the queued one");
  assert.equal(store.get("anime::s1::1::vostfr")?.status, "done");
  assert.notEqual(store.get("anime::s2::1::vostfr"), null, "another season is untouched");
});

test("a failure is reported in words the interface can show", async () => {
  const failing = (() => Promise.reject(new Error("ECONNRESET"))) as unknown as Fetch;
  const { store, downloads } = manager(failing);
  store.set("a", episode);
  downloads.enqueue({ id: "a", url: "https://cdn.test/a.mp4", provider: null });
  // Three attempts with a backoff between them, so this is not instant.
  await until(() => store.get("a")?.status === "error");

  assert.equal(store.get("a")?.status, "error");
  assert.match(store.get("a")?.error ?? "", /Connexion interrompue/);
});

test("leaves damaged records out of the library", () => {
  const { store, downloads } = manager();
  store.set("good", episode);
  store.set("broken", { type: "episode", status: "done" } as Partial<DownloadItem>);

  assert.deepEqual(
    downloads.list().map((item) => item.id),
    ["good"],
  );
});

test("refuses an id that would name the root", async () => {
  const { downloads } = manager();
  assert.equal((await downloads.cancel("")).success, false);
  assert.equal((await downloads.remove("")).success, false);
});
