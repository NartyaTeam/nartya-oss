import assert from "node:assert/strict";
import { test } from "node:test";
import { createFfmpegLookup } from "./ffmpeg.mts";

test("takes the first candidate that answers", async () => {
  const tried: string[] = [];
  const lookUp = createFfmpegLookup(async (path) => {
    tried.push(path);
    if (path !== "ffmpeg") throw new Error("no such binary");
  });
  assert.equal(await lookUp(), "ffmpeg");
  assert.deepEqual(tried, ["ffmpeg"]);
});

test("answers null rather than failing when nothing is installed", async () => {
  const lookUp = createFfmpegLookup(() => Promise.reject(new Error("no such binary")));
  assert.equal(await lookUp(), null);
});

test("looks once and remembers, including a negative answer", async () => {
  let calls = 0;
  const lookUp = createFfmpegLookup(() => {
    calls++;
    return Promise.reject(new Error("no such binary"));
  });
  await lookUp();
  await lookUp();
  assert.equal(calls, 1);
});

test("prefers an explicitly configured path", async () => {
  process.env.NARTYA_FFMPEG = "/opt/custom/ffmpeg";
  try {
    const lookUp = createFfmpegLookup(async () => {});
    assert.equal(await lookUp(), "/opt/custom/ffmpeg");
  } finally {
    delete process.env.NARTYA_FFMPEG;
  }
});
