import assert from "node:assert/strict";
import { test } from "node:test";
import { parseByteRange, sliceUpstream, type Upstream } from "./byte-range.mts";

test("parses the three forms players emit", () => {
  assert.deepEqual(parseByteRange("bytes=0-", 1000), { start: 0, end: 999 });
  assert.deepEqual(parseByteRange("bytes=100-199", 1000), { start: 100, end: 199 });
  assert.deepEqual(parseByteRange("bytes=-500", 1000), { start: 500, end: 999 });
  assert.deepEqual(parseByteRange("bytes=900-5000", 1000), { start: 900, end: 999 });
});

test("rejects what cannot be served", () => {
  assert.equal(parseByteRange("bytes=1000-", 1000), null, "start past the file");
  assert.equal(parseByteRange("bytes=200-100", 1000), null, "reversed bounds");
  assert.equal(parseByteRange("bytes=0-99,200-299", 1000), null, "multiple ranges");
  assert.equal(parseByteRange("bytes=0-", NaN), null, "unknown size");
  assert.equal(parseByteRange("", 1000), null);
});

const file = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256));

function fakeUpstream(buffer: Buffer, chunkSize: number): Upstream {
  return {
    destroy() {},
    async *[Symbol.asyncIterator]() {
      for (let i = 0; i < buffer.length; i += chunkSize) {
        yield buffer.subarray(i, Math.min(buffer.length, i + chunkSize));
      }
    },
  };
}

async function collect(slice: AsyncIterable<Buffer>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of slice) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test("returns exactly the requested range whatever the chunk size", async () => {
  for (const chunkSize of [1, 7, 64, 333, 1000, 4096]) {
    const out = await collect(sliceUpstream(fakeUpstream(file, chunkSize), 250, 749));
    assert.equal(out.length, 500, `length with chunk ${chunkSize}`);
    assert.ok(out.equals(file.subarray(250, 750)), `content with chunk ${chunkSize}`);
  }
});

test("handles the edges of the file", async () => {
  const head = await collect(sliceUpstream(fakeUpstream(file, 128), 0, 0));
  assert.ok(head.equals(file.subarray(0, 1)), "first byte alone");

  const tail = await collect(sliceUpstream(fakeUpstream(file, 128), 999, 999));
  assert.ok(tail.equals(file.subarray(999)), "last byte alone");

  const whole = await collect(sliceUpstream(fakeUpstream(file, 128), 0, 999));
  assert.ok(whole.equals(file), "whole file");
});

test("stops reading once the range is complete", async () => {
  let produced = 0;
  const counting: Upstream = {
    destroy() {},
    async *[Symbol.asyncIterator]() {
      for (let i = 0; i < file.length; i += 100) {
        produced += 100;
        yield file.subarray(i, i + 100);
      }
    },
  };

  const out = await collect(sliceUpstream(counting, 0, 149));
  assert.equal(out.length, 150);
  assert.equal(produced, 200, "stopped at the second chunk, not the tenth");
});
