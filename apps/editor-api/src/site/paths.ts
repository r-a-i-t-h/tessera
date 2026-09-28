import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

/** `apps/editor-api`, whether this module runs from `src/` or `dist/`. */
const here = dirname(fileURLToPath(import.meta.url));
export const editorApiRoot = join(here, "..", "..");
export const repoRoot = join(editorApiRoot, "..", "..");

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
 * A relative value is resolved from the repo root so `sites/pure` works
 * when npm runs the script from `apps/editor-api`.
 */
export function resolveDataRoot(): string {
  const fromEnv = process.env.TESSERA_DATA;
  if (!fromEnv) return join(repoRoot, "sites", "willow");
  return isAbsolute(fromEnv) ? fromEnv : join(repoRoot, fromEnv);
}
