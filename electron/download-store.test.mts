import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createItemStore } from "./download-store.mts";

function indexFile(): string {
  return join(mkdtempSync(join(tmpdir(), "nartya-dl-")), "downloads.json");
}

const episode = { type: "episode", slug: "a", status: "queued", percent: 0 } as const;

test("writes only once the delay has passed, then holds everything", () => {
  const file = indexFile();
  const store = createItemStore(file, 10_000);
  store.set("one", episode);
  store.set("one", { percent: 50 });

  assert.equal(store.get("one")?.percent, 50, "readable at once");
  store.flush();
  assert.equal(JSON.parse(readFileSync(file, "utf8")).one.percent, 50);
});

test("reloads what a previous run wrote", () => {
  const file = indexFile();
  const first = createItemStore(file, 0);
  first.set("one", episode, { now: true });

  assert.deepEqual(createItemStore(file).get("one")?.slug, "a");
});

test("treats an index written before downloads had a type as episodes", () => {
  const file = indexFile();
  writeFileSync(file, JSON.stringify({ one: { slug: "a", status: "done" } }));
  assert.equal(createItemStore(file).get("one")?.type, "episode");
});

test("starts empty rather than throwing on a damaged index", () => {
  const file = indexFile();
  writeFileSync(file, "{ this is not json");
  assert.deepEqual(createItemStore(file).all(), {});
  assert.deepEqual(createItemStore(join(file, "missing")).all(), {});
});

test("removing and clearing reach the disk immediately", () => {
  const file = indexFile();
  const store = createItemStore(file, 10_000);
  store.set("one", episode);
  store.set("two", episode);

  store.remove("one");
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(file, "utf8"))), ["two"]);
  store.clear();
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), {});
});

test("keeps the id whatever the patch says", () => {
  const store = createItemStore(indexFile(), 10_000);
  store.set("one", { ...episode, id: "somewhere-else" });
  assert.equal(store.get("one")?.id, "one");
});
