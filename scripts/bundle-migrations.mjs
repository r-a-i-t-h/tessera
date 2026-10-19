import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const outdir = process.argv[2];
if (!outdir) {
  console.error("usage: node scripts/bundle-migrations.mjs <outdir>");
  process.exit(1);
}

const migrationsDir = join(root, "deploy", "migrations");
const scriptsDir = join(root, "apps", "editor-api", "scripts");
const esbuild = join(root, "node_modules/esbuild/bin/esbuild");

function hookBundledMjs(hookPath) {
  const text = readFileSync(hookPath, "utf8");
  const match = text.match(/BUNDLED="\$ROOT\/([^"]+\.mjs)"/);
  return match ? match[1] : null;
}

function listMigrateScripts() {
  if (!existsSync(scriptsDir)) return [];
  return readdirSync(scriptsDir)
    .filter((name) => /^migrate-\d{3}-.+\.ts$/.test(name))
    .sort();
}

function listBundledHooks() {
  if (!existsSync(migrationsDir)) return [];
  const hooks = [];
  for (const name of readdirSync(migrationsDir).filter((n) => /^\d{3}-.+\.sh$/.test(n)).sort()) {
    const bundled = hookBundledMjs(join(migrationsDir, name));
    if (bundled) hooks.push({ hook: name, bundled });
  }
  return hooks;
}

function expectedScriptForBundled(bundledName) {
  const base = bundledName.replace(/\.mjs$/, "");
  return `migrate-${base}.ts`;
}

function expectedBundledForScript(scriptName) {
  const base = scriptName.replace(/^migrate-/, "").replace(/\.ts$/, "");
  return `${base}.mjs`;
}

const scripts = listMigrateScripts();
const hooks = listBundledHooks();
const scriptSet = new Set(scripts);
const bundledByScript = new Map(
  scripts.map((s) => [s, expectedBundledForScript(s)]),
);

for (const { hook, bundled } of hooks) {
  const script = expectedScriptForBundled(bundled);
  if (!scriptSet.has(script)) {
    console.error(`bundle-migrations: ${hook} expects ${bundled} but ${script} is missing`);
    process.exit(1);
  }
  const want = bundledByScript.get(script);
  if (want !== bundled) {
    console.error(
      `bundle-migrations: ${hook} BUNDLED=${bundled} but ${script} should bundle to ${want}`,
    );
    process.exit(1);
  }
}

for (const script of scripts) {
  const bundled = bundledByScript.get(script);
  const hookName = bundled.replace(/\.mjs$/, ".sh");
  const hookPath = join(migrationsDir, hookName);
  if (!existsSync(hookPath)) {
    console.error(`bundle-migrations: ${script} has no hook deploy/migrations/${hookName}`);
    process.exit(1);
  }
  const hookBundled = hookBundledMjs(hookPath);
  if (hookBundled !== bundled) {
    console.error(
      `bundle-migrations: deploy/migrations/${hookName} must set BUNDLED="$ROOT/${bundled}"`,
    );
    process.exit(1);
  }
}

mkdirSync(outdir, { recursive: true });

for (const script of scripts) {
  const bundled = bundledByScript.get(script);
  const outfile = join(outdir, bundled);
  const entry = join(scriptsDir, script);
  const result = spawnSync(
    esbuild,
    [
      entry,
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
    console.error(`bundle-migrations: ${script}: ${result.error.message}`);
    process.exit(1);
  }
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
  if (!existsSync(outfile)) {
    console.error(`bundle-migrations: ${bundled} missing after bundling ${script}`);
    process.exit(1);
  }
}

console.log(
  `bundle-migrations: wrote ${scripts.length} bundle(s) to ${outdir}: ${scripts.map((s) => bundledByScript.get(s)).join(", ")}`,
);
