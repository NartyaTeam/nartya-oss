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
