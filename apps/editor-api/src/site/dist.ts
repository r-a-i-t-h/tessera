import { copyFile, cp, mkdir, readdir, readFile, rm, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import {
  createDefaultRegistry,
  publishPages,
  searchIndexJson,
} from "@r-a-i-t-h/tessera-renderer";
import { registerExtras } from "@r-a-i-t-h/tessera-extras";
import { w3Skin } from "@r-a-i-t-h/tessera-skin-w3";
import { skinOverrideFile } from "./skin-override.js";
import { writeTextAtomic } from "../store/fs.js";
import { stylesheetsFromShell } from "./shell-stylesheets.js";
import { writeSnapshotFiles } from "./snapshot.js";
import { stripLegacyContentHeadingRules } from "./site-css.js";
import { collectBindingRuntimeModuleIds } from "@r-a-i-t-h/tessera-model";
import { flatRuntimeModuleName } from "./runtime-module.js";

export class DistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DistError";
  }
}

export type DistReport = {
  flavour: "pages" | "snapshot";
  /** HTML files written, not counting `sitemap.xml`. */
  pages?: number;
  snapshot?: { hash: string; file: string };
};

export type DistTarget = {
  publishDir: string;
  shellIndex: string;
  /** Directory that contains `tessera.js` and `tessera-pages.js` after the site build. */
  bundleDir: string;
  skinDir: string;
};

const KEEP_AT_ROOT = new Set(["media", "img", "skin", "data", "runtime-modules"]);

export function siteDelivery(site: { delivery?: string | undefined }): "pages" | "snapshot" {
  return site.delivery === "snapshot" ? "snapshot" : "pages";
}

/** Rebuild `publish/` for the site's delivery. Throws `DistError` before replacing HTML. */
export async function emitDist(document: SiteDocument, target: DistTarget): Promise<DistReport> {
  const flavour = siteDelivery(document.site);
  if (flavour === "snapshot") return emitSnapshot(document, target);
  return emitPages(document, target);
}

async function emitPages(document: SiteDocument, target: DistTarget): Promise<DistReport> {
  const pagesBundle = join(target.bundleDir, "tessera-pages.js");
  if (!existsSync(pagesBundle)) {
    throw new DistError("Build the site runtime first (tessera-pages.js is missing).");
  }
  if (!existsSync(target.skinDir)) {
    throw new DistError("Skin CSS is missing, so the pages dist was not written.");
  }
  const origin = requireOrigin(document.site.origin);
  const shell = await readOptional(target.shellIndex);
  const files = publishPages(document, {
    origin,
    registry: createDefaultRegistry(registerExtras),
    skin: w3Skin,
    stylesheets: stylesheetsFromShell(shell),
    script: "./tessera-pages.js",
  });
  await mkdir(target.publishDir, { recursive: true });
  for (const file of files) {
    await writeTextAtomic(join(target.publishDir, file.path), file.contents.endsWith("\n") ? file.contents : `${file.contents}\n`);
  }
  await writeTextAtomic(join(target.publishDir, "search-index.json"), searchIndexJson(document));
  await copyRuntime(target);
  await copySiteCss(target);
  await syncLibraryMedia(document, target.publishDir);
  await syncPublishedRuntimeModules(document, target.publishDir);
  await removeSnapshotData(target.publishDir);
  await removeGeneratedHtml(
    target.publishDir,
    new Set([...files.map((file) => file.path), "search-index.json"]),
  );
  return { flavour: "pages", pages: files.filter((file) => file.path.endsWith(".html")).length };
}

async function emitSnapshot(document: SiteDocument, target: DistTarget): Promise<DistReport> {
  const spaBundle = join(target.bundleDir, "tessera.js");
  if (!existsSync(spaBundle)) {
    throw new DistError("Build the site runtime first (tessera.js is missing).");
  }
  if (!existsSync(target.skinDir)) {
    throw new DistError("Skin CSS is missing, so the snapshot dist was not written.");
  }
  const shell = await readOptional(target.shellIndex);
  if (!shell) throw new DistError("The site shell is missing, so the snapshot dist was not written.");
  await mkdir(target.publishDir, { recursive: true });
  await writeTextAtomic(join(target.publishDir, "index.html"), shell.endsWith("\n") ? shell : `${shell}\n`);
  const snapshot = await writeSnapshotFiles(
    join(target.publishDir, "data", "site.json"),
    `${JSON.stringify(document, null, 2)}\n`,
  );
  await writeTextAtomic(join(target.publishDir, "search-index.json"), searchIndexJson(document));
  await copyRuntime(target);
  await copySiteCss(target);
  await syncLibraryMedia(document, target.publishDir);
  await syncPublishedRuntimeModules(document, target.publishDir);
  await removeGeneratedHtml(target.publishDir, new Set(["index.html", "search-index.json"]));
  return { flavour: "snapshot", snapshot };
}

function requireOrigin(value: string | undefined): string {
  const raw = value?.trim() ?? "";
  if (!raw) {
    throw new DistError("Set an absolute origin on the site before a pages dist can be written.");
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new DistError("Origin must be an absolute URL, such as https://willow.example.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new DistError("Origin must start with http:// or https://.");
  }
  if (url.search || url.hash) {
    throw new DistError("Origin must not include a query or hash.");
  }
  if (typedPath(raw).split("/").some((segment) => segment === "." || segment === "..")) {
    throw new DistError("Origin must not include . or .. path segments.");
  }
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path}`;
}

/** Path as typed, before the URL parser resolves `.` and `..`. */
function typedPath(raw: string): string {
  const scheme = raw.indexOf("//");
  const slash = scheme === -1 ? raw.indexOf("/") : raw.indexOf("/", scheme + 2);
  if (slash === -1) return "";
  const end = raw.search(/[?#]/);
  return raw.slice(slash, end === -1 ? undefined : end);
}

async function syncLibraryMedia(document: SiteDocument, publishDir: string): Promise<void> {
  const filesDir = join(dirname(publishDir), "files");
  if (!existsSync(filesDir)) return;
  const mediaDir = join(publishDir, "media");
  await mkdir(mediaDir, { recursive: true });
  const expected = new Set<string>();
  for (const item of document.media ?? []) {
    const name = flatMediaName(item.url);
    if (!name) continue;
    expected.add(name);
    const source = join(filesDir, name);
    if (existsSync(source)) await copyFile(source, join(mediaDir, name));
  }
  const entries = await readdir(mediaDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isFile() || expected.has(entry.name)) continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.[a-z0-9]+$/.test(entry.name)) continue;
    await unlink(join(mediaDir, entry.name)).catch(() => undefined);
  }
}

function flatMediaName(url: string): string | null {
  const match = /^\.\/media\/([^/]+)$/.exec(url);
  return match?.[1] ?? null;
}

async function syncPublishedRuntimeModules(document: SiteDocument, publishDir: string): Promise<void> {
  const srcDir = join(dirname(publishDir), "runtime-modules");
  if (!existsSync(srcDir)) return;
  const outDir = join(publishDir, "runtime-modules");
  await mkdir(outDir, { recursive: true });
  const needed = new Set(collectBindingRuntimeModuleIds(document));
  const expected = new Set<string>();
  for (const item of document.runtimeModules ?? []) {
    if (!needed.has(item.id)) continue;
    const name = flatRuntimeModuleName(item.url);
    if (!name) continue;
    expected.add(name);
    const source = join(srcDir, name);
    if (existsSync(source)) await copyFile(source, join(outDir, name));
  }
  const entries = await readdir(outDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isFile() || expected.has(entry.name)) continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.(mjs|js)$/.test(entry.name)) continue;
    await unlink(join(outDir, entry.name)).catch(() => undefined);
  }
}

async function copyRuntime(target: DistTarget): Promise<void> {
  await mkdir(target.publishDir, { recursive: true });
  const names = await readdir(target.bundleDir);
  for (const name of names) {
    if (!name.endsWith(".js")) continue;
    await copyFile(join(target.bundleDir, name), join(target.publishDir, name));
  }
  const skinOut = join(target.publishDir, "skin");
  await mkdir(skinOut, { recursive: true });
  for (const name of await readdir(target.skinDir)) {
    if (!name.endsWith(".css")) continue;
    await copyFile(join(target.skinDir, name), join(skinOut, name));
  }
  const shellDir = dirname(target.shellIndex);
  const cssDir = join(shellDir, "css");
  if (!existsSync(cssDir)) return;
  for (const name of await readdir(cssDir)) {
    const override = skinOverrideFile(shellDir, name);
    if (override) await copyFile(override, join(skinOut, name));
  }
}

async function copySiteCss(target: DistTarget): Promise<void> {
  const shellDir = dirname(target.shellIndex);
  const from = join(shellDir, "site.css");
  if (existsSync(from)) {
    const raw = await readFile(from, "utf8");
    const cleaned = stripLegacyContentHeadingRules(raw);
    const out = cleaned.endsWith("\n") ? cleaned : `${cleaned}\n`;
    await writeTextAtomic(join(target.publishDir, "site.css"), out);
    if (cleaned !== raw) {
      await writeTextAtomic(from, out);
    }
  }
  const localCss = join(shellDir, "local.css");
  if (existsSync(localCss)) {
    await copyFile(localCss, join(target.publishDir, "local.css"));
  }
  const localDir = join(shellDir, "local");
  if (existsSync(localDir)) {
    await cp(localDir, join(target.publishDir, "local"), { recursive: true });
  }
}

async function removeSnapshotData(publishDir: string): Promise<void> {
  const dataDir = join(publishDir, "data");
  let names: string[] = [];
  try {
    names = await readdir(dataDir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name === "site.json" || name === "rev.json" || /^site\.[a-f0-9]+\.json$/.test(name)) {
      await unlink(join(dataDir, name)).catch(() => undefined);
    }
  }
}

async function removeGeneratedHtml(publishDir: string, keep: Set<string>): Promise<void> {
  await walk(publishDir, "");

  async function walk(dir: string, rel: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (rel === "" && KEEP_AT_ROOT.has(entry.name)) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const child = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(child, childRel);
        const left = await readdir(child).catch(() => ["kept"]);
        if (left.length === 0) await rm(child, { recursive: false }).catch(() => undefined);
        continue;
      }
      if ((entry.name === "index.html" || entry.name === "sitemap.xml") && !keep.has(childRel)) {
        await unlink(child).catch(() => undefined);
      }
    }
  }
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}
