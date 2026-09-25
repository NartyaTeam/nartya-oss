import assert from "node:assert/strict";
import { test } from "node:test";
import type { DownloadItem, EpisodeDownload } from "../../../shared/downloads.ts";
import { formatSize, groupLibrary, nextDownloaded, offlineCopy } from "./library.ts";

const episode = (patch: Partial<EpisodeDownload>): EpisodeDownload => ({
  type: "episode",
  id: `${patch.slug ?? "a"}::${patch.seasonId ?? "saison1"}::${String(patch.ep ?? 1)}::vf`,
  slug: "a",
  animeTitle: "A",
  animeCover: null,
  coverFile: null,
  status: "done",
  percent: 100,
  sizeBytes: 100,
  createdAt: 1,
  seasonId: "saison1",
  ep: 1,
  lang: "vf",
  epThumb: null,
  thumbFile: null,
  epTitle: null,
  seasonName: null,
  provider: null,
  ...patch,
});

test("episodes are grouped by anime, the last one downloaded first", () => {
  const groups = groupLibrary([
    episode({ slug: "old", createdAt: 1 }),
    episode({ slug: "new", createdAt: 5 }),
    episode({ slug: "old", ep: 2, createdAt: 2 }),
  ]);
  assert.deepEqual(
    groups.map((group) => [group.slug, group.items.length]),
    [
      ["new", 1],
      ["old", 2],
    ],
  );
});

test("inside an anime, seasons come in their order and episodes by number", () => {
  const [group] = groupLibrary([
    episode({ seasonId: "saison10", ep: 1 }),
    episode({ seasonId: "saison2", ep: 3 }),
    episode({ seasonId: "saison2", ep: 1 }),
  ]);
  assert.deepEqual(
    group?.items.map((item) => `${item.seasonId}:${String(item.ep)}`),
    ["saison2:1", "saison2:3", "saison10:1"],
  );
});

test("a group counts what is done, running and failed, and what it weighs", () => {
  const [group] = groupLibrary([
    episode({ ep: 1, sizeBytes: 300 }),
    episode({ ep: 2, status: "downloading", sizeBytes: 50 }),
    episode({ ep: 3, status: "error", sizeBytes: 0 }),
  ]);
  assert.equal(group?.done, 1);
  assert.equal(group?.running, 1);
  assert.equal(group?.failed, 1);
  assert.equal(group?.bytes, 350);
});

test("scan chapters are left out, this app has no reader", () => {
  const scan: DownloadItem = {
    type: "scan",
    id: "scan::a::couleur::1",
    slug: "a",
    animeTitle: "A",
    animeCover: null,
    coverFile: null,
    status: "done",
    percent: 100,
    sizeBytes: 10,
    createdAt: 1,
    oeuvre: "couleur",
    oeuvreLabel: null,
    chapter: "1",
    folder: "1",
    pages: 20,
    imageBase: "",
  };
  assert.deepEqual(groupLibrary([scan]), []);
});

test("sizes read in megabytes, then gigabytes with a french decimal", () => {
  assert.equal(formatSize(0), "—");
  assert.equal(formatSize(350 * 1024 * 1024), "350 Mo");
  assert.equal(formatSize(1.5 * 1024 * 1024 * 1024), "1,5 Go");
});

test("only a finished download is played from disk", () => {
  assert.equal(offlineCopy(undefined), null);
  assert.equal(offlineCopy(episode({ status: "downloading" })), null);
  assert.equal(offlineCopy(episode({ status: "error" })), null);
  assert.notEqual(offlineCopy(episode({ status: "done" })), null);
});

test("a download that kept its segments plays through its playlist", () => {
  assert.deepEqual(offlineCopy(episode({ file: "playlist.m3u8" })), {
    id: "a::saison1::1::vf",
    file: "playlist.m3u8",
    isHls: true,
  });
});

test("a progressive download with no recorded file is the mp4", () => {
  assert.deepEqual(offlineCopy(episode({})), {
    id: "a::saison1::1::vf",
    file: "video.mp4",
    isHls: false,
  });
});

test("the next downloaded episode skips the ones not downloaded", () => {
  const playing = episode({ ep: 3 });
  const items = [
    episode({ ep: 2 }),
    playing,
    episode({ ep: 7 }),
    episode({ ep: 5 }),
    episode({ ep: 4, status: "downloading" }),
  ];
  assert.equal(nextDownloaded(items, playing)?.ep, 5);
});

test("the next downloaded episode stays in the same season and language", () => {
  const playing = episode({ ep: 1 });
  const items = [
    playing,
    episode({ ep: 2, seasonId: "saison2" }),
    episode({ ep: 2, lang: "vostfr", id: "a::saison1::2::vostfr" }),
    episode({ ep: 2, slug: "b" }),
  ];
  assert.equal(nextDownloaded(items, playing), undefined);
});
