import assert from "node:assert/strict";
import { test } from "node:test";
import { openOffline, type OfflineParts } from "./offline-open.ts";

const copy = { id: "a::saison1::1::vf", file: "video.mp4", isHls: false };
const never = () => new Promise<never>(() => {});

const parts = (patch: Partial<OfflineParts>): OfflineParts => ({
  localUrl: async () => "http://127.0.0.1:1/local?id=a",
  position: async () => 120,
  wait: async () => undefined,
  ...patch,
});

test("the file and the saved position open the episode", async () => {
  const opened = await openOffline(copy, parts({ wait: never }));
  assert.equal(opened.startAt, 120);
  assert.deepEqual(opened.source, {
    url: "http://127.0.0.1:1/local?id=a",
    isHls: false,
    host: null,
    local: true,
  });
});

test("a position that never comes starts from the top rather than waiting", async () => {
  const opened = await openOffline(copy, parts({ position: never }));
  assert.equal(opened.startAt, 0);
  assert.notEqual(opened.source, null);
});

test("a gone file opens nothing", async () => {
  const opened = await openOffline(copy, parts({ localUrl: async () => null }));
  assert.equal(opened.source, null);
});

test("a failing bridge or position read still settles", async () => {
  const opened = await openOffline(
    copy,
    parts({
      localUrl: () => Promise.reject(new Error("ipc")),
      position: () => Promise.reject(new Error("network")),
      wait: never,
    }),
  );
  assert.deepEqual(opened, { source: null, startAt: 0 });
});
