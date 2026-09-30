import { serve } from "@hono/node-server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SessionStore, SESSION_HANDOFF_FILE } from "./auth/sessions.js";
import { createApp } from "./app.js";
import { ensureExampleArchives } from "./site/backup.js";
import { editorApiRoot, repoRoot, resolveBackupDir, resolveDataRoot, resolveDistTarget, resolveSpaDir, siteLayout } from "./site/paths.js";
import { adoptLegacyRecordsDir } from "./site/records-dir.js";
import { SiteStore } from "./site/store.js";
import { ensureMetaFile, metaPath, readSchemaVersion } from "./store/meta.js";
import { UserStore } from "./store/users.js";

const root = editorApiRoot;
const dataDir = resolveDataRoot();
await adoptLegacyRecordsDir(dataDir);
const layout = siteLayout(dataDir);
const seedDir = process.env.TESSERA_SEED ?? join(root, "seed");
const backupDir = resolveBackupDir(dataDir);
const sitesDir = join(repoRoot, "sites");
const port = Number(process.env.PORT ?? 7356);

const users = new UserStore(dataDir);
await users.load(seedDir);
await ensureMetaFile(dataDir, seedDir);
await ensureExampleArchives(backupDir, {
  seedDir,
  sitesDir: existsSync(sitesDir) ? sitesDir : undefined,
});

const sessions = await SessionStore.load(join(dataDir, SESSION_HANDOFF_FILE));
const spaDir = resolveSpaDir(root);
const site = new SiteStore(
  layout.records,
  layout.previewOut,
  () => readSchemaVersion(metaPath(dataDir)),
  layout.history,
  resolveDistTarget(dataDir, root),
);
const app = createApp({
  users,
  sessions,
  spaDir,
  site,
  siteRoot: dataDir,
  backupDir,
  seedDir,
});

console.log(`Tessera editor API listening on http://127.0.0.1:${port}/`);
console.log(`Data directory: ${dataDir}`);
if (spaDir) {
  console.log(`Editor SPA: http://127.0.0.1:${port}/`);
}
console.log(`Site records: ${layout.records}`);
console.log(`Preview: ${layout.previewOut}`);
console.log(`Dist: ${layout.publishDir}`);
console.log(`Backups: ${backupDir}`);

const server = serve({ fetch: app.fetch, port });

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  try {
    await sessions.dump();
  } catch (err) {
    console.error(`[shutdown] ${signal} failed:`, err);
  }
  server.close((err) => {
    if (err) console.error("[shutdown] close failed:", err);
    process.exit(err ? 1 : 0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
