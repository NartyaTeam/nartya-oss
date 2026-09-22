import { existsSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { downloadToFile, runPool, type Fetch } from "./download-file.mts";

export type ScanJob = {
  imageBase: string;
  oeuvre: string;
  folder: string;
  pages: number;
  dir: string;
  signal: AbortSignal;
  onProgress: (done: number, total: number, bytes: number) => void;
};

const PAGE_CONCURRENCY = 6;

export function pageUrl(
  job: Pick<ScanJob, "imageBase" | "oeuvre" | "folder">,
  page: number,
): string {
  return `${job.imageBase}/${encodeURIComponent(job.oeuvre)}/${job.folder}/${page}.jpg`;
}

export function pageFile(page: number): string {
  return `p${String(page).padStart(3, "0")}.jpg`;
}

// The base comes from our own api, so pages skip the ssrf check, which would reject
// localhost in development and block every single page.
export function isTrustedBase(imageBase: string, apiBase: string | null, isDev: boolean): boolean {
  let parsed: URL;
  try {
    parsed = new URL(imageBase);
  } catch {
    return false;
  }
  if (apiBase) {
    try {
      if (parsed.origin === new URL(apiBase).origin) return true;
    } catch {
      return false;
    }
  }
  return isDev && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
}

export async function downloadScanChapter(fetch: Fetch, job: ScanJob): Promise<number> {
  if (!job.pages) throw new Error("Chapitre sans page");
  await mkdir(job.dir, { recursive: true });

  return runPool(
    job.pages,
    PAGE_CONCURRENCY,
    job.signal,
    async (index) => {
      const page = index + 1;
      const dest = join(job.dir, pageFile(page));
      // A page already on disk is skipped, so an interrupted chapter resumes.
      if (existsSync(dest)) {
        const { size } = statSync(dest);
        if (size > 0) return size;
      }
      return downloadToFile(fetch, pageUrl(job, page), dest, null, job.signal);
    },
    (done, bytes) => job.onProgress(done, job.pages, bytes),
  );
}
