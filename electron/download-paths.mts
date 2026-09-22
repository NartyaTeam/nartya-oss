import { accessSync, constants, existsSync, statSync } from "node:fs";
import { cp, rename, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { isPathInside } from "./url-safety.mts";

// An id carries "::" and the slug, so it is encoded rather than used as a folder name.
export function itemFolder(root: string, id: string): string {
  if (!isValidId(id)) throw new Error("Identifiant de téléchargement invalide");
  return join(root, Buffer.from(id).toString("base64url"));
}

// An empty id would name the root itself, and deleting an entry would take everything.
export function isValidId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 512;
}

export function resolveLocalFile(
  root: string | null,
  id: string,
  rel = "video.mp4",
): string | null {
  if (!root || !isValidId(id)) return null;
  const base = itemFolder(root, id);
  const file = resolve(base, rel);
  if (!isPathInside(file, base)) return null;
  return existsSync(file) ? file : null;
}

// Returns the message to show, or null when the folder is usable.
export function validateRoot(dir: unknown): string | null {
  if (typeof dir !== "string" || !dir || !isAbsolute(dir)) return "Chemin invalide";
  // A volume root would end up holding dozens of opaque folders.
  if (dirname(dir) === dir) return "Choisis un sous-dossier, pas la racine du disque";

  let entry;
  try {
    entry = statSync(dir);
  } catch {
    return "Ce dossier n'existe pas";
  }
  if (!entry.isDirectory()) return "Ce chemin n'est pas un dossier";

  try {
    accessSync(dir, constants.W_OK);
  } catch {
    return "Ce dossier n'est pas accessible en écriture";
  }
  return null;
}

export async function moveFolder(from: string, to: string): Promise<void> {
  try {
    await rename(from, to);
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    // Across volumes rename cannot work, so copy then drop the original.
    if (code !== "EXDEV" && code !== "EPERM") throw error;
    await cp(from, to, { recursive: true });
    await rm(from, { recursive: true, force: true });
  }
}
