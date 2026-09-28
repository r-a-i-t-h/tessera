import { serve } from "@hono/node-server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SessionStore, SESSION_HANDOFF_FILE } from "./auth/sessions.js";
import { createApp } from "./app.js";
import { editorApiRoot, resolveDataRoot, siteLayout } from "./site/paths.js";
import { SiteStore } from "./site/store.js";
import { ensureMetaFile, metaPath, readSchemaVersion } from "./store/meta.js";
import { UserStore } from "./store/users.js";

const root = editorApiRoot;
const dataDir = resolveDataRoot();
const layout = siteLayout(dataDir);
const seedDir = process.env.TESSERA_SEED ?? join(root, "seed");
const port = Number(process.env.PORT ?? 7356);

const users = new UserStore(dataDir);
await users.load(seedDir);
await ensureMetaFile(dataDir, seedDir);

const sessions = await SessionStore.load(join(dataDir, SESSION_HANDOFF_FILE));
const defaultSpa = join(root, "..", "editor", "dist");
const spaCandidate = process.env.TESSERA_SPA_DIR ?? defaultSpa;
const spaDir = existsSync(join(spaCandidate, "index.html")) ? spaCandidate : undefined;
const site = new SiteStore(
  layout.records,
  layout.flattenOut,
  () => readSchemaVersion(metaPath(dataDir)),
  layout.history,
);
const app = createApp({
  users,
  sessions,
  spaDir,
  site,
});

console.log(`Tessera editor API listening on http://127.0.0.1:${port}/`);
console.log(`Data directory: ${dataDir}`);
if (spaDir) {
  console.log(`Editor SPA: http://127.0.0.1:${port}/`);
}
console.log(`Site records: ${layout.records}`);
console.log(`Publish: ${layout.flattenOut}`);

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
