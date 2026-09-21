import type { Readable, Writable } from "node:stream";

// A progressive mp4 played by the native <video> has none of the buffer hls.js keeps, so
// it stalls on cdn jitter: read ahead from the cdn, write at the player's pace.
export function pipeWithReadAhead(
  upstream: Readable,
  sink: Writable,
  maxAheadBytes: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const queue: Buffer[] = [];
    let queued = 0;
    let ended = false;
    let failure: unknown = null;
    let aborted = false;
    let wakeProducer: (() => void) | null = null;
    let wakeConsumer: (() => void) | null = null;

    const wake = (slot: "producer" | "consumer") => {
      const waiting = slot === "producer" ? wakeProducer : wakeConsumer;
      if (!waiting) return;
      if (slot === "producer") wakeProducer = null;
      else wakeConsumer = null;
      waiting();
    };

    const abort = () => {
      if (aborted) return;
      aborted = true;
      upstream.destroy();
      wake("producer");
      wake("consumer");
    };

    // The client closing early is usually a seek reopening another range.
    sink.on("close", () => {
      if (!ended || queue.length > 0) abort();
    });

    void (async () => {
      try {
        for await (const chunk of upstream) {
          if (aborted) return;
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
          queue.push(buffer);
          queued += buffer.length;
          wake("consumer");
          while (queued >= maxAheadBytes && !aborted) {
            await new Promise<void>((ready) => (wakeProducer = ready));
          }
        }
      } catch (error) {
        if (!aborted) failure = error;
      } finally {
        ended = true;
        wake("consumer");
      }
    })();

    void (async () => {
      try {
        for (;;) {
          if (aborted) return resolve();
          const buffer = queue.shift();
          if (!buffer) {
            if (ended) break;
            await new Promise<void>((ready) => (wakeConsumer = ready));
            continue;
          }

          queued -= buffer.length;
          if (queued < maxAheadBytes) wake("producer");
          if (!sink.write(buffer)) await drained(sink);
        }
        if (failure) return reject(failure);
        sink.end();
        resolve();
      } catch (error) {
        abort();
        reject(error);
      }
    })();
  });
}

// Waits for drain, but does not hang if the client disconnects in the meantime.
function drained(sink: Writable): Promise<void> {
  return new Promise((ready) => {
    const onDrain = () => {
      sink.removeListener("close", onClose);
      ready();
    };
    const onClose = () => {
      sink.removeListener("drain", onDrain);
      ready();
    };
    sink.once("drain", onDrain);
    sink.once("close", onClose);
  });
}
