import { rm } from "node:fs/promises";

const targets = process.argv.slice(2);
if (targets.length === 0) throw new Error("clean: nothing to remove");

await Promise.all(targets.map((target) => rm(target, { recursive: true, force: true })));
