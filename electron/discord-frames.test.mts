import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeFrame, frameReader, OP } from "./discord-frames.mts";

test("a frame is its opcode and length, little endian, then the json", () => {
  const frame = encodeFrame(OP.handshake, { v: 1, client_id: "42" });
  const body = JSON.stringify({ v: 1, client_id: "42" });
  assert.equal(frame.readUInt32LE(0), 0);
  assert.equal(frame.readUInt32LE(4), Buffer.byteLength(body));
  assert.equal(frame.subarray(8).toString("utf8"), body);
});

test("frames split or stuck together by the socket come out whole", () => {
  const got: { op: number; payload: unknown }[] = [];
  const read = frameReader((op, payload) => got.push({ op, payload }));
  const both = Buffer.concat([
    encodeFrame(OP.frame, { evt: "READY", details: "é" }),
    encodeFrame(OP.ping, { n: 1 }),
  ]);

  read(both.subarray(0, 5));
  read(both.subarray(5, 30));
  read(both.subarray(30));

  assert.deepEqual(got, [
    { op: OP.frame, payload: { evt: "READY", details: "é" } },
    { op: OP.ping, payload: { n: 1 } },
  ]);
});

test("a body that is not json is dropped, and the next frame still reads", () => {
  const got: unknown[] = [];
  const read = frameReader((_op, payload) => got.push(payload));
  const broken = Buffer.alloc(8 + 3);
  broken.writeUInt32LE(OP.frame, 0);
  broken.writeUInt32LE(3, 4);
  broken.write("{no", 8);

  read(Buffer.concat([broken, encodeFrame(OP.frame, { ok: true })]));
  assert.deepEqual(got, [{ ok: true }]);
});
