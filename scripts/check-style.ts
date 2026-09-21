import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const roots = ["src", "shared", "electron", "scripts"];
const extensions = new Set([".ts", ".tsx", ".cts", ".mts", ".css"]);
const maxCommentLines = 2;

const pictographic = /\p{Extended_Pictographic}/u;
const decorative = new RegExp(
  "[\\u2190-\\u21FF\\u2500-\\u257F\\u25A0-\\u25FF\\u2700-\\u27BF]",
  "u",
);
const url = /https?:\/\/[^\s"'`)]+/;

// This checker and its fixtures contain the very patterns they look for.
const ignored = new Set(["scripts/check-style.ts", "scripts/check-style.test.ts"]);

export type Finding = { file: string; line: number; rule: string; text: string };

function commentOf(line: string, inBlock: boolean): { comment: boolean; inBlock: boolean } {
  const text = line.trim();
  if (inBlock) return { comment: true, inBlock: !text.includes("*/") };
  if (text.startsWith("/*")) return { comment: true, inBlock: !text.includes("*/") };
  return { comment: text.startsWith("//") || text.startsWith("*"), inBlock: false };
}

export function normalizePath(path: string): string {
  return path.split(sep).join("/").split("\\").join("/");
}

export function inspect(file: string, source: string): Finding[] {
  const findings: Finding[] = [];
  // A url in a test is a fixture; the rule exists so production code pins no host.
  const isTest = /\.test\.[cm]?tsx?$/.test(file);
  const lines = source.split("\n");
  let run = 0;
  let runStart = 0;
  let inBlock = false;

  const flushRun = () => {
    if (run > maxCommentLines) {
      findings.push({
        file,
        line: runStart,
        rule: "comment-block",
        text: `${run} comment lines in a row`,
      });
    }
    run = 0;
  };

  lines.forEach((line, index) => {
    const number = index + 1;
    const state = commentOf(line, inBlock);
    inBlock = state.inBlock;

    if (state.comment) {
      if (run === 0) runStart = number;
      run += 1;
    } else {
      flushRun();
    }

    if (pictographic.test(line) || decorative.test(line)) {
      findings.push({ file, line: number, rule: "emoji", text: line.trim() });
    }
    const match = isTest ? null : url.exec(line);
    if (match) {
      findings.push({ file, line: number, rule: "hardcoded-url", text: match[0] });
    }
  });
  flushRun();

  return findings;
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (extensions.has(extname(entry.name))) files.push(full);
  }
  return files;
}

async function main(): Promise<void> {
  const findings: Finding[] = [];
  for (const root of roots) {
    for (const file of await walk(root)) {
      const name = normalizePath(relative(".", file));
      if (ignored.has(name)) continue;
      findings.push(...inspect(name, await readFile(file, "utf8")));
    }
  }

  if (findings.length === 0) {
    console.log("check-style: clean");
    return;
  }
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line}  ${finding.rule}  ${finding.text}`);
  }
  console.error(`check-style: ${findings.length} finding(s)`);
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
