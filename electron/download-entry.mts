import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Fetch } from "./download-file.mts";
import { isValidId, itemFolder } from "./download-paths.mts";
import type { ItemStore } from "./download-store.mts";
import type { Pending, Result } from "./downloads.mts";

export type StartEpisode = {
  id: string;
  handle: string;
  slug: string;
  seasonId: string;
  ep: number;
  lang: string;
  animeTitle?: string;
  animeCover?: string | null;
  epThumb?: string | null;
  epTitle?: string | null;
  seasonName?: string | null;
  maxHeight?: number;
};

export type StartScan = {
  id: string;
  slug: string;
  oeuvre: string;
  oeuvreLabel?: string | null;
  chapter: string;
  folder: string;
  pages: number;
  imageBase: string;
  animeTitle?: string;
  animeCover?: string | null;
};

export type EntryParts = {
  store: ItemStore;
  root: () => string;
  fetch: Fetch;
  emit: (id: string) => void;
  enqueue: (pending: Pending) => void;
  resolveHandle: (handle: string) => { url: string; provider: string | null } | null;
  trustedScanBase: (imageBase: string) => boolean;
};

export type StartResult = Result & { alreadyExists?: boolean };

export function createEntries(parts: EntryParts) {
  const { store, root, fetch, emit, enqueue, resolveHandle, trustedScanBase } = parts;

  async function cacheImage(url: string | null | undefined, dest: string): Promise<boolean> {
    if (!url) return false;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (response.status < 200 || response.status >= 300) return false;
      const chunks: Buffer[] = [];
      for await (const chunk of response.stream) chunks.push(Buffer.from(chunk));
      await writeFile(dest, Buffer.concat(chunks));
      return true;
    } catch {
      return false;
    }
  }

  // A second start on a waiting entry would queue it twice, two runs writing one folder.
  function alreadyThere(id: string): boolean {
    const status = store.get(id)?.status;
    return (
      status === "done" ||
      status === "downloading" ||
      status === "queued" ||
      status === "processing"
    );
  }

  // The renderer only ever sends a handle, never a url to go and fetch.
  async function start(payload: StartEpisode): Promise<StartResult> {
    if (!isValidId(payload.id) || !payload.handle) {
      return { success: false, error: "Paramètres manquants" };
    }
    const target = resolveHandle(payload.handle);
    if (!target) return { success: false, error: "Lien de téléchargement expiré, relance-le." };
    if (alreadyThere(payload.id)) return { success: true, alreadyExists: true };

    const dir = itemFolder(root(), payload.id);
    await mkdir(dir, { recursive: true });
    const coverFile = (await cacheImage(payload.animeCover, join(dir, "cover.jpg")))
      ? "cover.jpg"
      : null;
    const thumbFile = (await cacheImage(payload.epThumb, join(dir, "thumb.jpg")))
      ? "thumb.jpg"
      : null;

    store.set(payload.id, {
      type: "episode",
      id: payload.id,
      slug: payload.slug,
      seasonId: payload.seasonId,
      ep: payload.ep,
      lang: payload.lang,
      animeTitle: payload.animeTitle || payload.slug,
      animeCover: payload.animeCover ?? null,
      coverFile,
      epThumb: payload.epThumb ?? null,
      thumbFile,
      epTitle: payload.epTitle ?? null,
      seasonName: payload.seasonName ?? null,
      provider: target.provider,
      status: "queued",
      percent: 0,
      sizeBytes: 0,
      createdAt: Date.now(),
    });
    emit(payload.id);

    enqueue({
      id: payload.id,
      url: target.url,
      provider: target.provider,
      maxHeight: payload.maxHeight ?? Infinity,
    });
    return { success: true };
  }

  async function startScan(payload: StartScan): Promise<StartResult> {
    if (!isValidId(payload.id) || !payload.oeuvre || !payload.pages || !payload.imageBase) {
      return { success: false, error: "Paramètres manquants" };
    }
    if (!trustedScanBase(payload.imageBase)) {
      return { success: false, error: "Source des pages non reconnue" };
    }
    if (alreadyThere(payload.id)) return { success: true, alreadyExists: true };

    const dir = itemFolder(root(), payload.id);
    await mkdir(dir, { recursive: true });
    const coverFile = (await cacheImage(payload.animeCover, join(dir, "cover.jpg")))
      ? "cover.jpg"
      : null;

    store.set(payload.id, {
      type: "scan",
      id: payload.id,
      slug: payload.slug,
      oeuvre: payload.oeuvre,
      oeuvreLabel: payload.oeuvreLabel ?? null,
      chapter: payload.chapter,
      folder: payload.folder,
      pages: payload.pages,
      imageBase: payload.imageBase,
      animeTitle: payload.animeTitle || payload.slug,
      animeCover: payload.animeCover ?? null,
      coverFile,
      status: "queued",
      percent: 0,
      sizeBytes: 0,
      createdAt: Date.now(),
    });
    emit(payload.id);

    enqueue({ id: payload.id });
    return { success: true };
  }

  return { start, startScan };
}
