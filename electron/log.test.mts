import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createLogging, formatLine, formatValue, shortenUrl, startFileLog } from "./log.mts";

const at = new Date("2026-09-22T01:19:00.123Z");

function collect(level: Parameters<typeof createLogging>[1] = "debug") {
  const lines: string[] = [];
  const logger = createLogging(
    (line) => lines.push(line),
    level,
    () => at,
  );
  return { lines, logger };
}

test("writes one line with the scope, the level and the fields", () => {
  const { lines, logger } = collect();
  logger("proxy").info("stream opened", { status: 206, hls: true });
  assert.equal(
    lines[0],
    "2026-09-22T01:19:00.123Z info  [proxy] stream opened status=206 hls=true",
  );
});

test("drops entries below the threshold", () => {
  const { lines, logger } = collect("warn");
  const log = logger("recipe");
  log.debug("a");
  log.info("b");
  log.warn("c");
  log.error("d");
  assert.deepEqual(
    lines.map((line) => line.split(" ")[1]),
    ["warn", "error"],
  );
});

test("skips undefined fields and keeps null", () => {
  assert.equal(
    formatLine(at, "info", "s", "m", { a: undefined, b: null }),
    `${head("info")} b=null`,
  );
});

test("quotes only what needs it", () => {
  assert.equal(formatValue("a", "plain"), "plain");
  assert.equal(formatValue("a", "two words"), '"two words"');
  assert.equal(formatValue("a", 3), "3");
  assert.equal(formatValue("a", { x: 1 }), '"{\\"x\\":1}"');
});

test("redacts anything that carries a credential", () => {
  assert.equal(formatValue("token", "abc"), "[redacted]");
  assert.equal(formatValue("Authorization", "Bearer abc"), "[redacted]");
});

test("keeps a url down to its host and first segment", () => {
  assert.equal(
    shortenUrl("https://host.test/embed/42?token=secret"),
    "https://host.test/embed/...",
  );
  assert.equal(shortenUrl("https://host.test/?token=secret"), "https://host.test");
  assert.equal(shortenUrl("not a url"), "not a url");
  assert.equal(
    formatValue("url", "https://host.test/embed/42?token=secret"),
    "https://host.test/embed/...",
  );
});

test("prints an error with its code and its stack", () => {
  const { lines, logger } = collect();
  const failure = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
  logger("proxy").error("segment failed", { err: failure, attempt: 2 });
  assert.equal(
    lines[0],
    `2026-09-22T01:19:00.123Z error [proxy] segment failed err="socket hang up (ECONNRESET)" attempt=2`,
  );
  assert.match(lines[1] ?? "", /at /);
});

test("leaves the stack out of a warning", () => {
  const { lines, logger } = collect();
  logger("proxy").warn("retrying", { err: new Error("nope") });
  assert.equal(lines.length, 1);
});

test("rotates the file once it is too large", () => {
  const directory = mkdtempSync(join(tmpdir(), "nartya-log-"));
  const path = join(directory, "nartya.log");
  writeFileSync(path, "x".repeat(6 * 1024 * 1024));

  assert.equal(startFileLog(directory), path);
  assert.equal(readFileSync(`${path}.old`, "utf8").length, 6 * 1024 * 1024);
});

function head(level: string): string {
  return `2026-09-22T01:19:00.123Z ${level.padEnd(5)} [s] m`;
}

test("redacts a credential wherever the word sits in the name", () => {
  for (const name of [
    "accessToken",
    "supabaseAnonKey",
    "sessionCookie",
    "refreshToken",
    "apiKey",
  ]) {
    assert.equal(formatValue(name, "secret-value"), "[redacted]", name);
  }
  assert.equal(formatValue("provider", "s1"), "s1", "an opaque provider id is not a secret");
  assert.equal(formatValue("status", 206), "206");
});
