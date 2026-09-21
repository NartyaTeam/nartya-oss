import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const roots = ["src", "shared", "electron"];
const extensions = new Set([".ts", ".tsx", ".cts", ".mts"]);

// Measured on the private codebase this repository replaces, for comparison.
const before = { commentRatio: 12.7, longestFile: 1411, filesOver300: 42, emojiFiles: 29 };

type Totals = { files: number; code: number; comments: number; longest: number; over300: number };

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

function measure(source: string): { code: number; comments: number; total: number } {
  let comments = 0;
  let code = 0;
  let inBlock = false;
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (inBlock) {
      comments += 1;
      if (line.includes("*/")) inBlock = false;
    } else if (line.startsWith("/*")) {
      comments += 1;
      inBlock = !line.includes("*/");
    } else if (line.startsWith("//")) {
      comments += 1;
    } else if (line !== "") {
      code += 1;
    }
  }
  return { code, comments, total: code + comments };
}

const totals: Totals = { files: 0, code: 0, comments: 0, longest: 0, over300: 0 };
for (const root of roots) {
  for (const file of await walk(root)) {
    const source = await readFile(file, "utf8");
    const counted = measure(source);
    const lines = source.split("\n").length;
    totals.files += 1;
    totals.code += counted.code;
    totals.comments += counted.comments;
    totals.longest = Math.max(totals.longest, lines);
    if (lines > 300) totals.over300 += 1;
  }
}

function percent(part: number, whole: number): string {
  return whole === 0 ? "0.0" : ((part / whole) * 100).toFixed(1);
}

console.log(`files            ${totals.files}`);
console.log(`code lines       ${totals.code}`);
console.log(`comment lines    ${totals.comments}`);
console.log(
  `comment ratio    ${percent(totals.comments, totals.code + totals.comments)}%  (before: ${before.commentRatio}%)`,
);
console.log(`longest file     ${totals.longest}  (before: ${before.longestFile})`);
console.log(`files over 300   ${totals.over300}  (before: ${before.filesOver300})`);
