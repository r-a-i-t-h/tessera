import { existsSync } from "node:fs";
import { cp, mkdtemp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { collectDeclaredZones, type LayoutNode } from "@r-a-i-t-h/tessera-model";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { runTar } from "./backup.js";
import { loadThemeManifest, type ThemeKitManifest } from "./theme-kit.js";
import { writeTextAtomic } from "../store/fs.js";

const KIT_ID_RE = /^[a-z][a-z0-9-]*$/;

export type ExportThemeKitOptions = {
  id: string;
  name: string;
  stack?: "w3" | "custom";
  version?: number;
};

function assertKitId(id: string): void {
  if (!KIT_ID_RE.test(id)) {
    throw new Error("Theme kit id must be lowercase letters, digits, and hyphens (e.g. my-theme).");
  }
}

function layoutNodeRoot(raw: Record<string, unknown>): LayoutNode | undefined {
  const root = raw.root;
  if (!root || typeof root !== "object" || Array.isArray(root)) return undefined;
  return root as LayoutNode;
}

function layoutIncludes(raw: Record<string, unknown>): string[] {
  const includes = raw.includes;
  if (!Array.isArray(includes)) return [];
  return includes.filter((item): item is string => typeof item === "string" && item.length > 0);
}

async function listLayoutFiles(layoutsDir: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(layoutsDir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw err;
  }
  return names.filter((name) => name.endsWith(".yaml")).sort();
}

function siteMergeBlock(site: Record<string, unknown>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  if (typeof site.style === "object" && site.style !== null && !Array.isArray(site.style)) {
    out.style = { ...(site.style as Record<string, unknown>) };
  }
  return Object.keys(out).length ? out : undefined;
}

function aspectsFromSite(site: Record<string, unknown>): ThemeKitManifest["aspects"] {
  const aspects = site.aspects;
  if (!Array.isArray(aspects)) return undefined;
  const out: NonNullable<ThemeKitManifest["aspects"]> = [];
  for (const entry of aspects) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const id = (entry as { id?: unknown }).id;
    const label = (entry as { label?: unknown }).label;
    if (typeof id !== "string" || typeof label !== "string") continue;
    out.push({ id, label });
  }
  return out.length ? out : undefined;
}

async function copyIfExists(src: string, dest: string): Promise<boolean> {
  try {
    await cp(src, dest, { recursive: true });
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return false;
    throw err;
  }
}

export async function exportThemeKit(siteRoot: string, options: ExportThemeKitOptions): Promise<Uint8Array> {
  const id = options.id.trim();
  const name = options.name.trim();
  assertKitId(id);
  if (!name) throw new Error("Theme kit name is required.");

  const stack = options.stack ?? "w3";
  if (stack !== "w3" && stack !== "custom") {
    throw new Error('Theme stack must be "w3" or "custom".');
  }

  const version = options.version ?? 1;
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("Theme kit version must be a positive integer.");
  }

  const sitePath = join(siteRoot, "records", "site.yaml");
  let site: Record<string, unknown>;
  try {
    site = parseYaml(await readFile(sitePath, "utf8")) as Record<string, unknown>;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") throw new Error("Site record is missing.");
    throw err;
  }

  const layoutsDir = join(siteRoot, "records", "layouts");
  const layoutFiles = await listLayoutFiles(layoutsDir);
  if (!layoutFiles.length) throw new Error("Site has no layouts to export.");

  const layoutIds: string[] = [];
  const zonesDeclared: Record<string, string[]> = {};
  const itemIds = new Set<string>();

  for (const file of layoutFiles) {
    if (file === "_order.yaml") continue;
    const text = await readFile(join(layoutsDir, file), "utf8");
    const raw = parseYaml(text) as Record<string, unknown>;
    const layoutId = typeof raw.id === "string" ? raw.id : basename(file, ".yaml");
    layoutIds.push(layoutId);
    for (const itemId of layoutIncludes(raw)) itemIds.add(itemId);
    const root = layoutNodeRoot(raw);
    if (root) {
      zonesDeclared[layoutId] = [...collectDeclaredZones(root)].sort();
    } else {
      zonesDeclared[layoutId] = [];
    }
  }
  layoutIds.sort();

  const hasOrder = layoutFiles.includes("_order.yaml");
  const patchLayoutIds = hasOrder ? [...layoutIds, "_order"] : layoutIds;

  const shellIndex = join(siteRoot, "shell", "index.html");
  const shellCss = join(siteRoot, "shell", "site.css");
  if (!existsSync(shellIndex) || !existsSync(shellCss)) {
    throw new Error("Shell index.html and site.css are required to export a theme.");
  }

  const manifest: ThemeKitManifest = {
    id,
    name,
    version,
    stack,
    patch: {
      layouts: "replace-listed",
      layoutIds: patchLayoutIds,
      shell: "replace",
      site: "merge-keys",
      types: "skip",
      items: itemIds.size ? "merge-listed" : "skip",
      itemIds: itemIds.size ? [...itemIds].sort() : undefined,
      nav: "skip",
    },
    zonesDeclared,
    demo: { optional: false, paths: [] },
  };

  if (typeof site.masterLayoutId === "string") manifest.masterLayoutId = site.masterLayoutId;
  if (typeof site.defaultLayoutId === "string") manifest.defaultLayoutId = site.defaultLayoutId;

  const aspects = aspectsFromSite(site);
  if (aspects) manifest.aspects = aspects;
  if (typeof site.defaultAspectId === "string" && aspects?.some((a) => a.id === site.defaultAspectId)) {
    manifest.defaultAspectId = site.defaultAspectId;
  }

  const siteBlock = siteMergeBlock(site);
  if (siteBlock) manifest.site = siteBlock;

  const stage = await mkdtemp(join(tmpdir(), "tessera-theme-export-"));
  const kitDir = join(stage, id);
  try {
    await mkdir(join(kitDir, "records", "layouts"), { recursive: true });
    if (itemIds.size) await mkdir(join(kitDir, "records", "items"), { recursive: true });
    await mkdir(join(kitDir, "shell"), { recursive: true });

    for (const file of layoutFiles) {
      await cp(join(layoutsDir, file), join(kitDir, "records", "layouts", file));
    }

    for (const itemId of itemIds) {
      const src = join(siteRoot, "records", "items", `${itemId}.yaml`);
      if (!existsSync(src)) throw new Error(`Layout includes missing item: ${itemId}`);
      await cp(src, join(kitDir, "records", "items", `${itemId}.yaml`));
    }

    await cp(shellIndex, join(kitDir, "shell", "index.html"));
    await cp(shellCss, join(kitDir, "shell", "site.css"));
    const imgSrc = join(siteRoot, "shell", "img");
    try {
      const st = await stat(imgSrc);
      if (st.isDirectory()) await cp(imgSrc, join(kitDir, "shell", "img"), { recursive: true });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw err;
    }

    await writeTextAtomic(join(kitDir, "manifest.yaml"), stringifyYaml(manifest));

    const validateRoot = join(stage, "_validate");
    await mkdir(join(validateRoot, "themes"), { recursive: true });
    await cp(kitDir, join(validateRoot, "themes", id), { recursive: true });
    await loadThemeManifest(validateRoot, id);

    const archivePath = join(stage, `${id}.tar.gz`);
    await runTar(["-czf", archivePath, "-C", stage, id]);
    return new Uint8Array(await readFile(archivePath));
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
