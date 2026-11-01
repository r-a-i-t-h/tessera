import { cp, mkdtemp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { extractTar } from "./backup.js";
import { loadThemeManifest, type ThemeKitInfo } from "./theme-kit.js";

const KIT_ID_RE = /^[a-z][a-z0-9-]*$/;

async function kitFolderFromExtract(extractDir: string): Promise<string> {
  const entries = await readdir(extractDir, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory());
  if (dirs.length !== 1) {
    throw new Error("Theme archive must contain a single top-level folder.");
  }
  const kitDir = join(extractDir, dirs[0]!.name);
  try {
    const manifest = await stat(join(kitDir, "manifest.yaml"));
    if (!manifest.isFile()) throw new Error("missing manifest");
  } catch (err) {
    if (err instanceof Error && err.message === "missing manifest") throw err;
    throw new Error("Theme archive folder must include manifest.yaml.");
  }
  return kitDir;
}

export async function importThemeKitArchive(seedDir: string, bytes: Uint8Array): Promise<ThemeKitInfo> {
  const stage = await mkdtemp(join(tmpdir(), "tessera-theme-import-"));
  const archive = join(stage, "kit.tar.gz");
  try {
    await writeFile(archive, bytes);
    const extractDir = join(stage, "extract");
    await extractTar(archive, extractDir);

    const kitDir = await kitFolderFromExtract(extractDir);
    const kitId = basename(kitDir);
    if (!KIT_ID_RE.test(kitId)) {
      throw new Error("Theme kit folder name must be a valid kit id (e.g. my-theme).");
    }

    const validateRoot = join(stage, "_validate");
    await mkdir(join(validateRoot, "themes"), { recursive: true });
    await cp(kitDir, join(validateRoot, "themes", kitId), { recursive: true });
    const manifest = await loadThemeManifest(validateRoot, kitId);

    const themesDir = join(seedDir, "themes");
    await mkdir(themesDir, { recursive: true });
    const dest = join(themesDir, kitId);
    await rm(dest, { recursive: true, force: true });
    await cp(kitDir, dest, { recursive: true });

    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      stack: manifest.stack,
      zonesDeclared: manifest.zonesDeclared,
    };
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
