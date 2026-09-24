import type { DownloadOutcome, DownloadRequest } from "../../../shared/downloads.ts";
import { choiceOf } from "../anime/season.ts";
import type { Source } from "../anime/types.ts";

export type Details = Omit<DownloadRequest, "token">;

// The picked host first, then the rest by rank: a download is not tied to one host the way
// playback is, and a dead host is no reason to download nothing.
export function downloadOrder(sources: Source[], picked: string): Source[] {
  const first = sources.filter((source) => choiceOf(source) === picked);
  return [...first, ...sources.filter((source) => !first.includes(source))];
}

type Start = (request: DownloadRequest) => Promise<DownloadOutcome>;
type Take = (stopped: () => boolean) => Promise<boolean>;

// Each source tried is one resolution counted by the api, so each waits for the budget.
export async function prepare(
  start: Start,
  take: Take,
  details: Details,
  sources: Source[],
  stopped: () => boolean,
): Promise<DownloadOutcome | null> {
  let last: DownloadOutcome = { ok: false, error: "Aucune source disponible" };
  for (const source of sources) {
    if (!(await take(stopped))) return null;
    last = await start({ ...details, token: source.id });
    if (last.ok) return last;
  }
  return last;
}
