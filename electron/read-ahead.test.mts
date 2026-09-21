import assert from "node:assert/strict";
import { PassThrough, Readable, Writable } from "node:stream";
import { test } from "node:test";
import { pipeWithReadAhead } from "./read-ahead.mts";

function collector(): Writable & { body: () => string } {
  const chunks: Buffer[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _encoding, done) {
      chunks.push(chunk);
      done();
    },
  });
  return Object.assign(sink, { body: () => Buffer.concat(chunks).toString() });
}

test("passes the whole stream through", async () => {
  const sink = collector();
  await pipeWithReadAhead(Readable.from(["ab", "cd", "ef"]), sink, 1024);
  assert.equal(sink.body(), "abcdef");
  assert.equal(sink.writableEnded, true);
});

test("stops reading upstream once the read ahead is full", async () => {
  const upstream = new PassThrough();
  const sink = new Writable({ write: () => {} });
  const pending = pipeWithReadAhead(upstream, sink, 8);

  upstream.write(Buffer.alloc(64));
  await new Promise((r) => setImmediate(r));
  // The consumer never calls its callback, so nothing drains and the producer waits.
  assert.equal(upstream.readableFlowing, false);

  upstream.destroy();
  await pending.catch(() => {});
});

test("propagates an upstream failure", async () => {
  const upstream = new Readable({
    read() {
      this.destroy(new Error("cdn dropped"));
    },
  });
  await assert.rejects(pipeWithReadAhead(upstream, collector(), 1024), { message: "cdn dropped" });
});

test("destroys the upstream when the client goes away", async () => {
  const upstream = new PassThrough();
  const sink = new PassThrough();
  const pending = pipeWithReadAhead(upstream, sink, 1024);

  upstream.write("partial");
  await new Promise((r) => setImmediate(r));
  sink.destroy();

  await pending;
  assert.equal(upstream.destroyed, true);
});
