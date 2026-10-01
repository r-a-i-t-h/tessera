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

export const SITE_NAMES = ["willow"] as const;
export type SiteName = (typeof SITE_NAMES)[number];

export function isSiteName(value: string): value is SiteName {
  return (SITE_NAMES as readonly string[]).includes(value);
}

/** One instance. Records, history, users, and the static export all live here. */
export function siteLayout(dataRoot: string) {
  return {
    root: dataRoot,
    records: join(dataRoot, "records"),
    history: join(dataRoot, "history"),
    /** SPA snapshot the dev server reads while editing. */
    previewOut: join(dataRoot, "preview", "data", "site.json"),
    /** Snapshot file inside the copyable dist, when delivery is `snapshot`. */
    publishOut: join(dataRoot, "publish", "data", "site.json"),
    /**
     * Where an editor save writes the SPA snapshot.
     * Same path as `previewOut`. Reference-site tools use `publishOut`.
     */
    flattenOut: join(dataRoot, "preview", "data", "site.json"),
    shellIndex: join(dataRoot, "shell", "index.html"),
    publishDir: join(dataRoot, "publish"),
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

/**
 * Built `tessera.js`, `tessera-pages.js`, and skin CSS.
 * A checkout uses `apps/site/dist` and `packages/skin-w3/css` after
 * `npm run build -w @r-a-i-t-h/tessera-site`. A release carries the same
 * bytes at `<root>/runtime` and `<root>/skin`.
 */
export function resolveRuntimeDirs(
  apiRoot: string,
  monorepoRoot: string,
): { bundleDir: string; skinDir: string } {
  const checkoutBundle = join(monorepoRoot, "apps", "site", "dist");
  const releaseBundle = join(apiRoot, "runtime");
  const checkoutSkin = join(monorepoRoot, "packages", "skin-w3", "css");
  const releaseSkin = join(apiRoot, "skin");
  const checkout = existsSync(join(monorepoRoot, "sites"));
  let bundleDir = releaseBundle;
  if (existsSync(join(checkoutBundle, "tessera.js"))) bundleDir = checkoutBundle;
  else if (existsSync(join(releaseBundle, "tessera.js"))) bundleDir = releaseBundle;
  else if (checkout) bundleDir = checkoutBundle;
  return {
    bundleDir,
    skinDir: existsSync(checkoutSkin) ? checkoutSkin : releaseSkin,
  };
}

/** Where a rebuilt dist copies its runtime and skin from. */
export function resolveDistTarget(dataRoot: string, apiRoot: string): {
  publishDir: string;
  shellIndex: string;
  bundleDir: string;
  skinDir: string;
} {
  return {
    publishDir: join(dataRoot, "publish"),
    shellIndex: join(dataRoot, "shell", "index.html"),
    ...resolveRuntimeDirs(apiRoot, repoRoot),
  };
}
