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
    resolveHandle: (handle) =>
      handle === "h" ? { url: "https://cdn.test/a.mp4", provider: null } : null,
    trustedScanBase: (base) => base.startsWith("https://api.test"),
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

test("creates an entry from a handle, never from a url", async () => {
  const { store, downloads } = manager();
  const refused = await downloads.start({
    id: "a",
    handle: "gone",
    slug: "anime",
    seasonId: "s1",
    ep: 1,
    lang: "vostfr",
  });
  assert.equal(refused.success, false);
  assert.match(refused.error ?? "", /expiré/);
  assert.equal(store.get("a"), null);
});

test("does not start an episode twice", async () => {
  const { store, downloads } = manager(slow(200));
  const payload = { id: "a", handle: "h", slug: "anime", seasonId: "s1", ep: 1, lang: "vostfr" };
  await downloads.start(payload);
  const again = await downloads.start(payload);

  assert.equal(again.alreadyExists, true);
  assert.equal(store.get("a")?.slug, "anime");
});

test("refuses scan pages from a base that is not ours", async () => {
  const { store, downloads } = manager();
  const result = await downloads.startScan({
    id: "scan::a::b::1",
    slug: "a",
    oeuvre: "b",
    chapter: "1",
    folder: "ch-1",
    pages: 3,
    imageBase: "https://evil.test/images",
  });
  assert.equal(result.success, false);
  assert.match(result.error ?? "", /non reconnue/);
  assert.equal(store.get("scan::a::b::1"), null);
});

function reviewManager(fetch: Fetch) {
  const root = mkdtempSync(join(tmpdir(), "nartya-rev-"));
  const store = createItemStore(join(root, "index.json"), 10_000);
  const downloads = createDownloads({
    store,
    root: () => root,
    fetch,
    ffmpeg: () => Promise.resolve(null),
    onChange: () => {},
    resolveHandle: () => ({ url: "https://cdn.test/a.m3u8", provider: null }),
    trustedScanBase: () => true,
  });
  return { store, downloads };
}

const hls = ["#EXTM3U", "#EXTINF:4,", "seg1.ts"].join("\n");

test("records which file the download actually produced", async () => {
  const fetch = ((url: string) =>
    Promise.resolve({
      url,
      status: 200,
      statusText: "OK",
      headers: { "content-length": "9" },
      stream: Readable.from([Buffer.from(url.endsWith(".m3u8") ? hls : "segbytes")]),
    })) as unknown as Fetch;

  const { store, downloads } = reviewManager(fetch);
  store.set("a", { type: "episode", slug: "anime", status: "queued", percent: 0 });
  downloads.enqueue({ id: "a", url: "https://cdn.test/a.m3u8", provider: null });
  await new Promise((done) => setTimeout(done, 200));

  assert.equal(store.get("a")?.status, "done");
  // Without ffmpeg an hls download is a playlist, not a video.mp4. Playing it back means
  // knowing that, or /local is asked for a file that does not exist.
  assert.equal(store.get("a")?.file, "playlist.m3u8");
});

test("a removed entry is not brought back by a late progress tick", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((done) => (release = done));
  const fetch = ((url: string, options: { signal: AbortSignal }) =>
    gate.then(() => {
      if (options.signal.aborted) throw new DOMException("Aborted", "AbortError");
      return {
        url,
        status: 200,
        statusText: "OK",
        headers: { "content-length": "8" },
        stream: Readable.from([Buffer.from("segbytes")]),
      };
    })) as unknown as Fetch;

  const { store, downloads } = reviewManager(fetch);
  store.set("a", { type: "episode", slug: "anime", status: "queued", percent: 0 });
  downloads.enqueue({ id: "a", url: "https://cdn.test/a.mp4", provider: null });

  store.remove("a");
  release();
  await new Promise((done) => setTimeout(done, 300));

  assert.equal(store.get("a"), null, "a record with no title breaks the offline library");
});

test("an episode waiting in the queue is not queued a second time", async () => {
  const { store, downloads } = manager(slow(200));
  const payload = (id: string) => ({
    id,
    handle: "h",
    slug: "anime",
    seasonId: "s1",
    ep: 1,
    lang: "vostfr",
  });
  await downloads.start(payload("a"));
  await downloads.start(payload("b"));
  await downloads.start(payload("c"));
  assert.equal(store.get("c")?.status, "queued");

  const again = await downloads.start(payload("c"));
  assert.equal(again.alreadyExists, true);
});

test("what a crash left running comes back as interrupted, not running for ever", () => {
  const root = mkdtempSync(join(tmpdir(), "nartya-dl-"));
  const store = createItemStore(join(root, "index.json"), 10_000);
  store.set("a", { ...episode, status: "downloading", percent: 40 });
  store.set("b", episode);
  store.set("c", { ...episode, status: "done", percent: 100 });

  createDownloads({
    store,
    root: () => root,
    fetch: slow(0),
    ffmpeg: () => Promise.resolve(null),
    onChange: () => undefined,
    resolveHandle: () => null,
    trustedScanBase: () => false,
  });

  assert.equal(store.get("a")?.status, "error");
  assert.equal(store.get("a")?.error, "Interrompu");
  assert.equal(store.get("b")?.status, "error");
  assert.equal(store.get("c")?.status, "done");
});
