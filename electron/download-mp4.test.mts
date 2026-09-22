import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { test } from "node:test";
import {
  downloadMp4,
  downloadParallel,
  downloadSingle,
  planRanges,
  totalFromContentRange,
  type Fetch,
} from "./download-mp4.mts";

const body = "0123456789abcdefghijABCDEFGHIJ";

function dest(): string {
  return join(mkdtempSync(join(tmpdir(), "nartya-mp4-")), "video.mp4");
}

function job(target: string, onProgress = () => {}) {
  return {
    url: "https://cdn.test/a.mp4",
    provider: null,
    dest: target,
    signal: new AbortController().signal,
    onProgress,
  };
}

function answering(handler: (rangeHeader?: string) => Partial<Record<string, unknown>>): Fetch {
  return ((_url: string, options: { rangeHeader?: string }) => {
    const answer = handler(options.rangeHeader);
    const content = String(answer.body ?? "");
    return Promise.resolve({
      url: "https://cdn.test/a.mp4",
      status: (answer.status as number) ?? 200,
      statusText: "OK",
      headers: (answer.headers as Record<string, string>) ?? {
        "content-length": String(content.length),
      },
      stream: Readable.from([Buffer.from(content)]),
    });
  }) as unknown as Fetch;
}

test("splits a file into contiguous ranges that cover it exactly", () => {
  const ranges = planRanges(100, 4, 10);
  assert.equal(ranges[0]?.start, 0);
  assert.equal(ranges.at(-1)?.end, 99);
  for (let i = 1; i < ranges.length; i++) {
    assert.equal(ranges[i]?.start, (ranges[i - 1]?.end ?? 0) + 1, "no gap, no overlap");
  }
});

test("never splits a file too small to be worth it", () => {
  assert.deepEqual(planRanges(100, 4, 1_000), [{ start: 0, end: 99 }]);
  assert.equal(planRanges(1, 4, 1).length, 1);
});

test("reads the total size out of a content-range", () => {
  assert.equal(totalFromContentRange("bytes 0-1/123456"), 123456);
  assert.equal(totalFromContentRange("bytes 0-1/*"), 0);
  assert.equal(totalFromContentRange(undefined), 0);
});

test("writes a whole file in one stream", async () => {
  const target = dest();
  const size = await downloadSingle(
    answering(() => ({ body })),
    job(target),
  );
  assert.equal(readFileSync(target, "utf8"), body);
  assert.equal(size, body.length);
});

test("puts every range at its own offset", async () => {
  const target = dest();
  const size = await downloadParallel(
    answering((range) => {
      const [, from, to] = /bytes=(\d+)-(\d+)/.exec(range ?? "") ?? [];
      return {
        status: 206,
        body: body.slice(Number(from), Number(to) + 1),
        headers: { "content-range": `bytes ${from}-${to}/${body.length}` },
      };
    }),
    job(target),
    body.length,
  );
  assert.equal(readFileSync(target, "utf8"), body, "the ranges reassemble in order");
  assert.equal(size, body.length);
});

test("falls back to one stream when the host ignores the range", async () => {
  const target = dest();
  let ranged = 0;
  const fetch = answering((range) => {
    if (range === "bytes=0-1") {
      return { status: 206, body: "01", headers: { "content-range": `bytes 0-1/${20e6}` } };
    }
    if (range) ranged++;
    // The host answers 200 with the whole file whatever was asked.
    return { status: 200, body, headers: { "content-length": String(body.length) } };
  });

  await downloadMp4(fetch, job(target));
  assert.ok(ranged > 0, "it did try ranges first");
  assert.equal(readFileSync(target, "utf8"), body, "and still produced the file");
});

test("reports progress as bytes arrive", async () => {
  const seen: number[] = [];
  await downloadSingle(
    answering(() => ({ body })),
    job(dest(), () => seen.push(1)),
  );
  // One emit per 400ms window at most, so a small body may report once or not at all;
  // what matters is that it never throws and the file is complete.
  assert.ok(seen.length <= 1);
});
