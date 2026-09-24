export type DownloadStatus =
  "queued" | "downloading" | "processing" | "done" | "error" | "canceled";

type Common = {
  id: string;
  slug: string;
  animeTitle: string;
  animeCover: string | null;
  coverFile: string | null;
  status: DownloadStatus;
  percent: number;
  sizeBytes: number;
  createdAt: number;
  // What the download produced: video.mp4, or playlist.m3u8 when the segments were kept.
  file?: string;
  finishedAt?: number;
  error?: string;
};

export type EpisodeDownload = Common & {
  type: "episode";
  seasonId: string;
  ep: number;
  lang: string;
  epThumb: string | null;
  thumbFile: string | null;
  epTitle: string | null;
  seasonName: string | null;
  provider: string | null;
};

export type ScanDownload = Common & {
  type: "scan";
  oeuvre: string;
  oeuvreLabel: string | null;
  chapter: string;
  folder: string;
  pages: number;
  imageBase: string;
};

export type DownloadItem = EpisodeDownload | ScanDownload;

// One entry per episode and language. The main process cancels a season by this prefix.
export const downloadId = (slug: string, seasonId: string, ep: number, lang: string): string =>
  `${slug}::${seasonId}::${String(ep)}::${lang}`;

export const seasonPrefix = (slug: string, seasonId: string): string => `${slug}::${seasonId}::`;

// The renderer hands a sealed source token: the main process resolves it, the url stays there.
export type DownloadRequest = {
  token: string;
  slug: string;
  seasonId: string;
  ep: number;
  lang: string;
  animeTitle: string;
  animeCover: string | null;
  epThumb: string | null;
  epTitle: string | null;
  seasonName: string | null;
};

export type DownloadOutcome = { ok: true } | { ok: false; error: string };
