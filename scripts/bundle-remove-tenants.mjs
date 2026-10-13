import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = process.argv[2];
if (!outfile) {
  console.error("usage: node scripts/bundle-remove-tenants.mjs <outfile>");
  process.exit(1);
}

mkdirSync(dirname(outfile), { recursive: true });
const result = spawnSync(
  join(root, "node_modules/esbuild/bin/esbuild"),
  [
    join(root, "apps/editor-api/scripts/migrate-003-remove-tenants.ts"),
    "--bundle",
    "--platform=node",
    "--format=esm",
    "--target=node20",
    "--external:yaml",
    `--outfile=${outfile}`,
  ],
  { stdio: "inherit" },
);
if (result.error) {
  console.error(`bundle-remove-tenants: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
