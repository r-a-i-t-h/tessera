import { cp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { createDataBackup, rollback, type RestoreResult } from "./backup.js";
import { writeTextAtomic } from "../store/fs.js";

export type ThemeKitPatch = {
  layouts?: "replace-listed" | "skip";
  layoutIds?: string[];
  shell?: "replace" | "skip";
  site?: "merge-keys" | "skip";
  types?: "replace-listed" | "merge-listed" | "skip";
  typeIds?: string[];
  items?: "replace-listed" | "merge-listed" | "skip";
  itemIds?: string[];
  nav?: "replace" | "skip";
};

export type ThemeKitAspect = {
  id: string;
  label: string;
};

export type ThemeKitManifest = {
  id: string;
  name: string;
  version: number;
  stack: "w3" | "custom";
  masterLayoutId?: string;
  defaultLayoutId?: string;
  /** Looks this kit offers. Absent means clear the site catalog on apply. */
  aspects?: ThemeKitAspect[];
  defaultAspectId?: string;
  patch: ThemeKitPatch;
  zonesDeclared?: Record<string, string[]>;
  site?: Record<string, unknown>;
  demo?: {
    optional?: boolean;
    paths?: string[];
  };
};

const ASPECT_ID = /^[a-z][a-z0-9-]*$/;

export type ThemeKitInfo = {
  id: string;
  name: string;
  version: number;
  stack: string;
  zonesDeclared?: Record<string, string[]>;
};

export type ApplyThemeResult = RestoreResult & {
  kitId: string;
  importDemo: boolean;
};

function kitRoot(seedDir: string, kitId: string): string {
  return join(seedDir, "themes", kitId);
}

function assertSafeRelative(path: string): void {
  if (path.includes("..") || path.startsWith("/")) {
    throw new Error(`Unsafe kit path: ${path}`);
  }
}

export async function listThemeKits(seedDir: string): Promise<ThemeKitInfo[]> {
  const themesDir = join(seedDir, "themes");
  let ids: string[];
  try {
    const dirents = await readdir(themesDir, { withFileTypes: true });
    ids = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw err;
  }

  const out: ThemeKitInfo[] = [];
  for (const id of ids) {
    try {
      const manifest = await loadThemeManifest(seedDir, id);
      out.push({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        stack: manifest.stack,
        zonesDeclared: manifest.zonesDeclared,
      });
    } catch {
      // skip invalid kit folders
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export async function loadThemeManifest(seedDir: string, kitId: string): Promise<ThemeKitManifest> {
  const path = join(kitRoot(seedDir, kitId), "manifest.yaml");
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new Error(`Theme kit not found: ${kitId}`);
    throw err;
  }
  const raw = parseYaml(text) as ThemeKitManifest;
  if (!raw?.id || raw.id !== kitId) {
    throw new Error(`Theme manifest id must match folder name (${kitId}).`);
  }
  if (!raw.name || !raw.version || !raw.stack || !raw.patch) {
    throw new Error(`Theme kit ${kitId} has an invalid manifest.`);
  }
  validateThemeAspects(kitId, raw);
  return raw;
}

function validateThemeAspects(kitId: string, manifest: ThemeKitManifest): void {
  const aspects = manifest.aspects;
  if (aspects === undefined) {
    if (manifest.defaultAspectId !== undefined) {
      throw new Error(`Theme kit ${kitId} sets defaultAspectId without aspects.`);
    }
    return;
  }
  if (!Array.isArray(aspects)) {
    throw new Error(`Theme kit ${kitId} aspects must be a list.`);
  }
  const seen = new Set<string>();
  for (const aspect of aspects) {
    if (!aspect || typeof aspect !== "object") {
      throw new Error(`Theme kit ${kitId} has an invalid aspect entry.`);
    }
    if (typeof aspect.id !== "string" || !ASPECT_ID.test(aspect.id)) {
      throw new Error(`Theme kit ${kitId} has an invalid aspect id.`);
    }
    if (typeof aspect.label !== "string" || !aspect.label.trim()) {
      throw new Error(`Theme kit ${kitId} aspect ${aspect.id} needs a label.`);
    }
    if (seen.has(aspect.id)) {
      throw new Error(`Theme kit ${kitId} has a duplicate aspect id: ${aspect.id}`);
    }
    seen.add(aspect.id);
  }
  if (manifest.defaultAspectId !== undefined) {
    if (typeof manifest.defaultAspectId !== "string" || !seen.has(manifest.defaultAspectId)) {
      throw new Error(`Theme kit ${kitId} defaultAspectId is not in aspects.`);
    }
  }
}

async function copyKitFile(
  seedDir: string,
  kitId: string,
  relative: string,
  destRoot: string,
): Promise<void> {
  assertSafeRelative(relative);
  const src = join(kitRoot(seedDir, kitId), relative);
  const dest = join(destRoot, relative);
  await mkdir(dirname(dest), { recursive: true });
  await cp(src, dest);
}

async function mergeSiteYaml(siteRoot: string, manifest: ThemeKitManifest): Promise<void> {
  const sitePath = join(siteRoot, "records", "site.yaml");
  let existing: Record<string, unknown> = {};
  try {
    existing = parseYaml(await readFile(sitePath, "utf8")) as Record<string, unknown>;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw err;
  }

  if (manifest.masterLayoutId) existing.masterLayoutId = manifest.masterLayoutId;
  if (manifest.defaultLayoutId) existing.defaultLayoutId = manifest.defaultLayoutId;
  if (manifest.site && typeof manifest.site === "object") {
    for (const [key, value] of Object.entries(manifest.site)) {
      if (key === "style" && value && typeof value === "object" && !Array.isArray(value)) {
        const prev = isRecord(existing.style) ? existing.style : {};
        existing.style = { ...prev, ...(value as Record<string, unknown>) };
      } else {
        existing[key] = value;
      }
    }
  }

  // Theme owns the aspect catalog. Absent means clear.
  if (manifest.aspects?.length) {
    existing.aspects = manifest.aspects.map((item) => ({ id: item.id, label: item.label }));
  } else {
    delete existing.aspects;
  }
  if (manifest.defaultAspectId) {
    existing.defaultAspectId = manifest.defaultAspectId;
  } else {
    delete existing.defaultAspectId;
  }

  await writeTextAtomic(sitePath, stringifyYaml(existing));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function applyListedRecords(
  seedDir: string,
  kitId: string,
  siteRoot: string,
  kind: "layouts" | "types" | "items",
  ids: string[] | undefined,
): Promise<void> {
  if (!ids?.length) return;
  for (const id of ids) {
    await copyKitFile(seedDir, kitId, join("records", kind, `${id}.yaml`), siteRoot);
  }
}

async function copyShellAssets(seedDir: string, kitId: string, siteRoot: string): Promise<void> {
  const imgSrc = join(kitRoot(seedDir, kitId), "shell", "img");
  try {
    const st = await stat(imgSrc);
    if (!st.isDirectory()) return;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return;
    throw err;
  }
  const imgDest = join(siteRoot, "shell", "img");
  await rm(imgDest, { recursive: true, force: true });
  await cp(imgSrc, imgDest, { recursive: true });
}

async function importDemoContent(seedDir: string, kitId: string, siteRoot: string, paths: string[]): Promise<void> {
  for (const rel of paths) {
    assertSafeRelative(rel);
    const src = join(kitRoot(seedDir, kitId), "demo", rel);
    const dest = join(siteRoot, "records", rel);
    await mkdir(dirname(dest), { recursive: true });
    await cp(src, dest);
  }
}

export async function applyThemeKit(
  siteRoot: string,
  backupDir: string,
  seedDir: string,
  kitId: string,
  options?: { importDemo?: boolean },
): Promise<ApplyThemeResult> {
  const manifest = await loadThemeManifest(seedDir, kitId);
  const patch = manifest.patch;
  const importDemo = options?.importDemo === true && !!manifest.demo?.paths?.length;

  const safetyBackup = await createDataBackup(siteRoot, backupDir);
  try {
    if (patch.shell === "replace") {
      await copyKitFile(seedDir, kitId, join("shell", "index.html"), siteRoot);
      await copyKitFile(seedDir, kitId, join("shell", "site.css"), siteRoot);
      await copyShellAssets(seedDir, kitId, siteRoot);
    }

    if (patch.layouts === "replace-listed") {
      await applyListedRecords(seedDir, kitId, siteRoot, "layouts", patch.layoutIds);
      if (patch.layoutIds?.includes("_order")) {
        await copyKitFile(seedDir, kitId, join("records", "layouts", "_order.yaml"), siteRoot);
      }
    }

    if (patch.types === "replace-listed" || patch.types === "merge-listed") {
      await applyListedRecords(seedDir, kitId, siteRoot, "types", patch.typeIds);
    }

    if (patch.items === "replace-listed" || patch.items === "merge-listed") {
      await applyListedRecords(seedDir, kitId, siteRoot, "items", patch.itemIds);
    }

    if (patch.nav === "replace") {
      await copyKitFile(seedDir, kitId, join("records", "nav.yaml"), siteRoot);
    }

    if (patch.site === "merge-keys") {
      await mergeSiteYaml(siteRoot, manifest);
    }

    if (importDemo && manifest.demo?.paths) {
      await importDemoContent(seedDir, kitId, siteRoot, manifest.demo.paths);
    }
  } catch (err) {
    await rollback(siteRoot, backupDir, safetyBackup.name);
    throw err;
  }

  return {
    restored: kitId,
    safetyBackup: safetyBackup.name,
    kitId,
    importDemo,
  };
}

export async function resetThemeDemo(
  siteRoot: string,
  backupDir: string,
  seedDir: string,
  kitId: string,
): Promise<RestoreResult> {
  const manifest = await loadThemeManifest(seedDir, kitId);
  const paths = manifest.demo?.paths ?? [];
  if (!paths.length) throw new Error("This kit has no demo content to remove.");

  const safetyBackup = await createDataBackup(siteRoot, backupDir);
  try {
    for (const rel of paths) {
      assertSafeRelative(rel);
      await rm(join(siteRoot, "records", rel), { force: true });
    }
  } catch (err) {
    await rollback(siteRoot, backupDir, safetyBackup.name);
    throw err;
  }

  return { restored: `${kitId}-demo-reset`, safetyBackup: safetyBackup.name };
}
