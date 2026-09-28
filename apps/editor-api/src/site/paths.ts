import { existsSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * API root: the directory that contains `seed/` and, in a release, `spa/`.
 * Source and `tsc` output live in `…/site/paths.js` (two levels down).
 * A bundled `dist/server.js` is one level down from the release root.
 */
export function apiRootFromModule(moduleDir: string): string {
  return basename(moduleDir) === "site" ? join(moduleDir, "..", "..") : join(moduleDir, "..");
}

const here = dirname(fileURLToPath(import.meta.url));
export const editorApiRoot = apiRootFromModule(here);

/** Monorepo checkout when `sites/` sits two levels above the API; otherwise the release root. */
export function resolveRepoRoot(apiRoot: string): string {
  const monorepo = join(apiRoot, "..", "..");
  return existsSync(join(monorepo, "sites")) ? monorepo : apiRoot;
}

export const repoRoot = resolveRepoRoot(editorApiRoot);

/** `sites/` holds example data. The preview and the editor render into the instance directory. */
export function isReferenceSitePath(target: string): boolean {
  const sites = resolve(repoRoot, "sites");
  const resolved = resolve(target);
  return resolved === sites || resolved.startsWith(sites + sep);
}

export const SITE_NAMES = ["pure", "ineffable", "millersark", "willow"] as const;
export type SiteName = (typeof SITE_NAMES)[number];

export function isSiteName(value: string): value is SiteName {
  return (SITE_NAMES as readonly string[]).includes(value);
}

/** One instance. Records, history, users, and the static export all live here. */
export function siteLayout(dataRoot: string) {
  return {
    root: dataRoot,
    records: join(dataRoot, "data"),
    history: join(dataRoot, "history"),
    flattenOut: join(dataRoot, "publish", "data", "site.json"),
    shellIndex: join(dataRoot, "shell", "index.html"),
    publishIndex: join(dataRoot, "publish", "index.html"),
  };
}

/**
 * Instance directory. Absolute `TESSERA_DATA` is used as given.
 * A relative value is resolved from the repo root so `data` works
 * when npm runs the script from `apps/editor-api`.
 */
export function resolveDataRoot(): string {
  const fromEnv = process.env.TESSERA_DATA;
  if (!fromEnv) return join(repoRoot, "data");
  return isAbsolute(fromEnv) ? fromEnv : join(repoRoot, fromEnv);
}

/** Sibling of the site directory. On a VPS that is `/opt/tessera/<name>/backup`. */
export function defaultBackupDir(dataDir: string): string {
  return join(dirname(dataDir), "backup");
}

/**
 * Offline archives. Absolute `TESSERA_BACKUP` is used as given.
 * Unset uses the sibling `backup` directory, which an update does not replace.
 */
export function resolveBackupDir(dataDir: string): string {
  const fromEnv = process.env.TESSERA_BACKUP;
  if (!fromEnv) return defaultBackupDir(dataDir);
  return isAbsolute(fromEnv) ? fromEnv : join(repoRoot, fromEnv);
}

/**
 * Built editor UI. A release keeps it at `<root>/spa` so one process serves it.
 * A checkout falls back to `apps/editor/dist`. `TESSERA_SPA_DIR` replaces both.
 */
export function resolveSpaDir(
  apiRoot: string,
  env: string | undefined = process.env.TESSERA_SPA_DIR,
): string | undefined {
  const fromEnv = env?.trim();
  const candidates = fromEnv
    ? [fromEnv]
    : [join(apiRoot, "spa"), join(apiRoot, "..", "editor", "dist")];
  return candidates.find((dir) => existsSync(join(dir, "index.html")));
}
