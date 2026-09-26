import { createLogger } from "./log.mts";

const log = createLogger("discord-frames");

export const OP = { handshake: 0, frame: 1, close: 2, ping: 3, pong: 4 } as const;

const HEADER = 8;

export function encodeFrame(op: number, payload: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const header = Buffer.alloc(HEADER);
  header.writeUInt32LE(op, 0);
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

// A socket hands over bytes as they come, not frame by frame.
export function frameReader(onFrame: (op: number, payload: unknown) => void) {
  let held = Buffer.alloc(0);
  return (chunk: Buffer): void => {
    held = Buffer.concat([held, chunk]);
    while (held.length >= HEADER) {
      const size = held.readUInt32LE(4);
      if (held.length < HEADER + size) return;
      const op = held.readUInt32LE(0);
      const body = held.subarray(HEADER, HEADER + size).toString("utf8");
      held = held.subarray(HEADER + size);
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch (err) {
        log.warn("unreadable frame", { op, err });
        continue;
      }
      onFrame(op, payload);
    }
  };
}
