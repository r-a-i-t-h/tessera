import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(appRoot, "..", "..");
const viteBin = join(repoRoot, "node_modules", ".bin", "vite");
const env = { ...process.env };
delete env.TESSERA_SITE;

const result = spawnSync(viteBin, ["build", "--config", join(appRoot, "vite.config.ts")], {
  cwd: appRoot,
  env,
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);
