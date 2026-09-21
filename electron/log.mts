import { createWriteStream, mkdirSync, renameSync, statSync, type WriteStream } from "node:fs";
import { join } from "node:path";

export type Level = "debug" | "info" | "warn" | "error";
export type Fields = Record<string, unknown>;

export type Logger = {
  debug: (message: string, fields?: Fields) => void;
  info: (message: string, fields?: Fields) => void;
  warn: (message: string, fields?: Fields) => void;
  error: (message: string, fields?: Fields) => void;
};

export type Write = (line: string) => void;

const RANK: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MAX_FILE_BYTES = 5 * 1024 * 1024;
// Matched anywhere in the name: accessToken and anonKey are exactly what someone reaches
// for. A name ending in key goes too, so log an opaque source key as provider instead.
const secretKey = /auth|token|password|passwd|cookie|secret|credential|bearer|session|key$/i;
const absoluteUrl = /^[a-z][a-z0-9+.-]*:\/\//i;

export function isLevel(value: string): value is Level {
  return value in RANK;
}

// Main process logs travel in bug reports: an embed url identifies a host, a query
// string carries signed tokens. Host and first segment are enough to follow a trace.
export function shortenUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const [first] = url.pathname.split("/").filter(Boolean);
    return first ? `${url.origin}/${first}/...` : url.origin;
  } catch {
    return raw;
  }
}

function describeError(error: Error): string {
  const code = (error as NodeJS.ErrnoException).code;
  return code ? `${error.message} (${code})` : error.message;
}

export function formatValue(key: string, value: unknown): string {
  if (secretKey.test(key)) return "[redacted]";
  if (value instanceof Error) return quote(describeError(value));
  if (typeof value === "string") return quote(absoluteUrl.test(value) ? shortenUrl(value) : value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  return quote(JSON.stringify(value) ?? String(value));
}

function quote(text: string): string {
  const clean = text.replace(/[\n\r\t]+/g, " ");
  return /[\s"=]/.test(clean) ? JSON.stringify(clean) : clean;
}

export function formatLine(
  time: Date,
  level: Level,
  scope: string,
  message: string,
  fields: Fields = {},
): string {
  const pairs = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${formatValue(key, value)}`);
  const head = `${time.toISOString()} ${level.padEnd(5)} [${scope}] ${message}`;
  return pairs.length > 0 ? `${head} ${pairs.join(" ")}` : head;
}

function stacks(fields: Fields): string[] {
  return Object.values(fields)
    .filter((value): value is Error => value instanceof Error && typeof value.stack === "string")
    .map((error) => error.stack ?? "")
    .map((stack) => stack.split("\n").slice(1).join("\n"))
    .filter((stack) => stack.length > 0);
}

export function createLogging(write: Write, level: Level, now: () => Date = () => new Date()) {
  return function logger(scope: string): Logger {
    const at =
      (entry: Level) =>
      (message: string, fields: Fields = {}) => {
        if (RANK[entry] < RANK[level]) return;
        write(formatLine(now(), entry, scope, message, fields));
        // Only errors get a stack: anywhere else it buries the line that matters.
        if (entry === "error") for (const stack of stacks(fields)) write(stack);
      };
    return { debug: at("debug"), info: at("info"), warn: at("warn"), error: at("error") };
  };
}

function envLevel(): Level {
  const wanted = process.env.NARTYA_LOG_LEVEL?.toLowerCase();
  if (wanted && isLevel(wanted)) return wanted;
  return process.env.NODE_ENV === "development" ? "debug" : "info";
}

let file: WriteStream | null = null;

function emit(line: string): void {
  process.stdout.write(`${line}\n`);
  file?.write(`${line}\n`);
}

export const createLogger = createLogging(emit, envLevel());

// Rotated once at startup rather than on every write: the single instance lock means
// there is never a second writer to race with.
export function startFileLog(directory: string, name = "nartya.log"): string | null {
  const path = join(directory, name);
  try {
    mkdirSync(directory, { recursive: true });
    const existing = statSync(path, { throwIfNoEntry: false });
    if (existing && existing.size > MAX_FILE_BYTES) {
      renameSync(path, `${path}.old`);
    }
    file = createWriteStream(path, { flags: "a" });
    file.on("error", () => {
      file = null;
    });
    return path;
  } catch {
    return null;
  }
}
