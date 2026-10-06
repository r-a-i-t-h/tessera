import { existsSync } from "node:fs";
import { join } from "node:path";

const FIXED = new Set(["w3.css", "tessera.css", "microapps.css"]);

/** A skin file a site may replace with `shell/css/<name>`. */
export function isSkinOverrideName(name: string): boolean {
  if (name.includes("/") || name.includes("\\") || name.includes("\0")) return false;
  return FIXED.has(name) || /^w3-theme-[a-z0-9-]+\.css$/.test(name);
}

/** Site copy of a skin file, when one has been saved. */
export function skinOverrideFile(shellDir: string, name: string): string | null {
  if (!isSkinOverrideName(name)) return null;
  const path = join(shellDir, "css", name);
  return existsSync(path) ? path : null;
}
