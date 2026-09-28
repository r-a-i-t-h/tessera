import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(appRoot, "..", "..");
const names = ["pure", "ineffable", "millersark", "willow"];
const only = process.argv[2];
if (only && !names.includes(only)) {
  console.error(`Unknown site "${only}". Expected one of: ${names.join(", ")}`);
  process.exit(1);
}
const viteBin = join(repoRoot, "node_modules", ".bin", "vite");
const env = { ...process.env };
delete env.TESSERA_SITE;

const result = spawnSync(viteBin, ["build", "--config", join(appRoot, "vite.config.ts")], {
  cwd: appRoot,
  env,
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);

const bundle = join(appRoot, "dist", "tessera.js");
const skinSrc = join(repoRoot, "packages", "skin-w3", "css");

for (const name of only ? [only] : names) {
  const publish = join(repoRoot, "sites", name, "publish");
  const shell = join(repoRoot, "sites", name, "shell");
  rmSync(join(publish, "assets"), { recursive: true, force: true });
  copyFileSync(bundle, join(publish, "tessera.js"));
  const skinOut = join(publish, "skin");
  mkdirSync(skinOut, { recursive: true });
  for (const file of readdirSync(skinSrc)) {
    if (!file.endsWith(".css")) continue;
    copyFileSync(join(skinSrc, file), join(skinOut, file));
  }
  copyFileSync(join(shell, "index.html"), join(publish, "index.html"));
  copyFileSync(join(shell, "site.css"), join(publish, "site.css"));
}
