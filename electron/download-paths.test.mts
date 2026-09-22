import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { test } from "node:test";
import { isValidId, itemFolder, resolveLocalFile, validateRoot } from "./download-paths.mts";

const root = mkdtempSync(join(tmpdir(), "nartya-root-"));
const id = "anime::s1::1::vostfr";

test("names a folder from an id that could not be one", () => {
  const folder = itemFolder(root, id);
  assert.equal(folder.includes("::"), false);
  assert.equal(itemFolder(root, id), folder, "same id, same folder");
  assert.notEqual(itemFolder(root, "other"), folder);
});

test("refuses an id that would name the root itself", () => {
  assert.equal(isValidId(""), false);
  assert.equal(isValidId("x".repeat(513)), false);
  assert.equal(isValidId(null), false);
  assert.throws(() => itemFolder(root, ""));
});

test("serves a file inside the entry and nothing above it", () => {
  const folder = itemFolder(root, id);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "video.mp4"), "bytes");
  writeFileSync(join(root, "secret.txt"), "no");

  assert.equal(resolveLocalFile(root, id), join(folder, "video.mp4"));
  assert.equal(resolveLocalFile(root, id, `..${sep}secret.txt`), null, "traversal");
  assert.equal(resolveLocalFile(root, id, "missing.mp4"), null);
  assert.equal(resolveLocalFile(null, id), null);
  assert.equal(resolveLocalFile(root, ""), null);
});

test("names why a chosen folder cannot be used", () => {
  assert.equal(validateRoot(root), null);
  assert.equal(validateRoot("relative/path"), "Chemin invalide");
  assert.equal(validateRoot(""), "Chemin invalide");
  assert.equal(validateRoot(resolve(sep)), "Choisis un sous-dossier, pas la racine du disque");
  assert.equal(validateRoot(join(root, "nope")), "Ce dossier n'existe pas");
  assert.equal(validateRoot(join(root, "secret.txt")), "Ce chemin n'est pas un dossier");
});
