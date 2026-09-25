import assert from "node:assert/strict";
import { test } from "node:test";
import type { DownloadItem, EpisodeDownload } from "../../../shared/downloads.ts";
import { formatSize, groupLibrary } from "./library.ts";

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
