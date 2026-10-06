import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import type { Context } from "hono";
import { apiError, isResponse } from "../http.js";
import { authenticatedEditor } from "../middleware/editor-site.js";
import {
  backupPath,
  createDataBackup,
  deleteBackup,
  listBackups,
  listExamples,
  restoreDataBackup,
  restoreExample,
} from "../site/backup.js";

export const backupRoutes = new Hono();
backupRoutes.use("/backups", authenticatedEditor);
backupRoutes.use("/backups/*", authenticatedEditor);
backupRoutes.use("/examples/*", authenticatedEditor);

backupRoutes.get("/backups", async (c) => {
  const dirs = configured(c);
  if (isResponse(dirs)) return dirs;
  const backups = await listBackups(dirs.backupDir);
  const examples = await listExamples(dirs.backupDir);
  return c.json({ ok: true, directory: dirs.backupDir, backups, examples });
});

backupRoutes.post("/backups", async (c) => {
  const dirs = configured(c);
  if (isResponse(dirs)) return dirs;
  try {
    const created = await createDataBackup(dirs.siteRoot, dirs.backupDir);
    return c.json({ ok: true, ...created });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Backup failed");
  }
});

backupRoutes.get("/backups/:name", async (c) => {
  const dirs = configured(c);
  if (isResponse(dirs)) return dirs;
  const name = c.req.param("name");
  const path = backupPath(dirs.backupDir, name);
  if (!path) return apiError(c, 400, "Invalid backup name");
  try {
    const bytes = await readFile(path);
    return new Response(Uint8Array.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return apiError(c, 404, "Backup not found");
    throw err;
  }
});

backupRoutes.post("/backups/:name/delete", async (c) => {
  const dirs = configured(c);
  if (isResponse(dirs)) return dirs;
  const name = c.req.param("name");
  if (!backupPath(dirs.backupDir, name)) return apiError(c, 400, "Invalid backup name");
  const removed = await deleteBackup(dirs.backupDir, name);
  if (!removed) return apiError(c, 404, "Backup not found");
  return c.json({ ok: true, deleted: name });
});

backupRoutes.post("/backups/:name/restore", async (c) => {
  const dirs = configured(c);
  if (isResponse(dirs)) return dirs;
  const name = c.req.param("name");
  if (!backupPath(dirs.backupDir, name)) return apiError(c, 400, "Invalid backup name");
  try {
    const result = await restoreDataBackup(dirs.siteRoot, dirs.backupDir, name);
    await dirs.users.load(dirs.seedDir);
    return c.json({ ok: true, ...result });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Restore failed");
  }
});

backupRoutes.post("/examples/:name/restore", async (c) => {
  const dirs = configured(c);
  if (isResponse(dirs)) return dirs;
  try {
    const result = await restoreExample(dirs.siteRoot, dirs.backupDir, c.req.param("name"));
    await dirs.users.load(dirs.seedDir);
    return c.json({ ok: true, ...result });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Restore failed");
  }
});

function configured(c: Context): { siteRoot: string; backupDir: string; seedDir: string; users: { load: (seedDir?: string) => Promise<void> } } | Response {
  const siteRoot = c.get("siteRoot");
  const backupDir = c.get("backupDir");
  if (!siteRoot || !backupDir) return apiError(c, 404, "No site data directory configured.");
  return { siteRoot, backupDir, seedDir: c.get("seedDir") ?? "", users: c.get("users") };
}
