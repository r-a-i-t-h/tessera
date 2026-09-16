import { serve } from "@hono/node-server";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SessionStore, SESSION_HANDOFF_FILE } from "./auth/sessions.js";
import { createApp } from "./app.js";
import { UserStore } from "./store/users.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataDir = process.env.TESSERA_DATA ?? join(root, "data");
const seedDir = process.env.TESSERA_SEED ?? join(root, "seed");
const port = Number(process.env.PORT ?? 7356);
const assetBase = process.env.TESSERA_BASE_PATH ?? "";

const users = new UserStore(dataDir);
await users.load(seedDir);

const sessions = await SessionStore.load(join(dataDir, SESSION_HANDOFF_FILE));
const defaultSpa = join(root, "..", "editor", "dist");
const spaCandidate = process.env.TESSERA_SPA_DIR ?? defaultSpa;
const spaDir = existsSync(join(spaCandidate, "index.html")) ? spaCandidate : undefined;
const app = createApp({
  users,
  sessions,
  assetBase,
  spaDir,
});

const baseLabel = assetBase ? `/${assetBase.replace(/^\/+|\/+$/g, "")}` : "";
console.log(`Tessera editor API listening on http://127.0.0.1:${port}${baseLabel}/`);
console.log(`Data directory: ${dataDir}`);
if (spaDir) {
  console.log(`Editor SPA: http://127.0.0.1:${port}${baseLabel}/`);
}

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
