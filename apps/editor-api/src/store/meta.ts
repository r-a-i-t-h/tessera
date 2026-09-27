import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { readText, writeJsonAtomic } from "./fs.js";

/**
 * Authoring-data schema counter in `$TESSERA_DATA/meta.json`.
 * Migrations (`deploy/post-update.sh`) are the only writer of `schemaVersion`.
 * The app copies a seed file once, then preserves whatever is already there.
 */
export function metaPath(dataDir: string): string {
  return join(dataDir, "meta.json");
}

export async function ensureMetaFile(dataDir: string, seedDir?: string): Promise<void> {
  const dest = metaPath(dataDir);
  try {
    await readText(dest);
    return;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  await mkdir(dataDir, { recursive: true });
  if (seedDir) {
    try {
      await copyFile(join(seedDir, "meta.json"), dest);
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
  await writeJsonAtomic(dest, {});
}

/** Missing file or a non-numeric `schemaVersion` is 0 (migrations not applied). */
export async function readSchemaVersion(file: string): Promise<number> {
  let text: string;
  try {
    text = await readText(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw err;
  }
  const meta = JSON.parse(text) as { schemaVersion?: unknown };
  const version = Number(meta.schemaVersion);
  if (!Number.isFinite(version)) return 0;
  return Math.trunc(version);
}
