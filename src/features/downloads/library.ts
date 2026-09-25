import type { DownloadItem, EpisodeDownload } from "../../../shared/downloads.ts";

export type Group = {
  slug: string;
  title: string;
  cover: string | null;
  coverOwner: EpisodeDownload;
  items: EpisodeDownload[];
  done: number;
  running: number;
  failed: number;
  bytes: number;
};

const RUNNING: DownloadItem["status"][] = ["queued", "downloading", "processing"];

export const isRunning = (item: DownloadItem): boolean => RUNNING.includes(item.status);
export const isFailed = (item: DownloadItem): boolean =>
  item.status === "error" || item.status === "canceled";

export type OfflineCopy = { id: string; file: string; isHls: boolean };

// A progressive download records no file name: it is always video.mp4.
export function offlineCopy(item: DownloadItem | undefined): OfflineCopy | null {
  if (item?.status !== "done") return null;
  const file = item.file ?? "video.mp4";
  return { id: item.id, file, isHls: file.endsWith(".m3u8") };
}

// Anime most recently added first; inside one, seasons in turn and episodes in order.
export function groupLibrary(items: DownloadItem[]): Group[] {
  const episodes = items.filter((item): item is EpisodeDownload => item.type === "episode");
  const bySlug = new Map<string, EpisodeDownload[]>();
  for (const item of episodes) bySlug.set(item.slug, [...(bySlug.get(item.slug) ?? []), item]);

  const groups = [...bySlug.values()].map((list): Group => {
    const sorted = [...list].sort(
      (a, b) => a.seasonId.localeCompare(b.seasonId, "fr", { numeric: true }) || a.ep - b.ep,
    );
    const latest = list.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
    return {
      slug: latest.slug,
      title: latest.animeTitle,
      cover: latest.animeCover,
      coverOwner: list.find((item) => item.coverFile) ?? latest,
      items: sorted,
      done: list.filter((item) => item.status === "done").length,
      running: list.filter(isRunning).length,
      failed: list.filter(isFailed).length,
      bytes: list.reduce((sum, item) => sum + (item.sizeBytes || 0), 0),
    };
  });

  const newest = (group: Group) => Math.max(...group.items.map((item) => item.createdAt));
  return groups.sort((a, b) => newest(b) - newest(a));
}

export function formatSize(bytes: number): string {
  if (!bytes) return "—";
  const megabytes = bytes / (1024 * 1024);
  if (megabytes < 1024) return `${String(Math.round(megabytes))} Mo`;
  return `${(megabytes / 1024).toFixed(1).replace(".", ",")} Go`;
}
