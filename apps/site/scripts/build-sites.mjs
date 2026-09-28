import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
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

for (const name of only ? [only] : names) {
  rmSync(join(repoRoot, "sites", name, "publish", "assets"), { recursive: true, force: true });
  const result = spawnSync(viteBin, ["build", "--config", join(appRoot, "vite.config.ts")], {
    cwd: appRoot,
    env: { ...process.env, TESSERA_SITE: name },
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
