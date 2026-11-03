import { Hono } from "hono";
import { Buffer } from "node:buffer";
import { assertFullAdmin } from "../access/level.js";
import { apiError } from "../http.js";
import { authenticatedEditor, authenticatedSiteRoot } from "../middleware/editor-site.js";
import { applyThemeKit, listThemeKits, resetThemeDemo } from "../site/theme-kit.js";
import { exportThemeKit } from "../site/theme-export.js";
import { importThemeKitArchive } from "../site/theme-import.js";

export const themeRoutes = new Hono();
themeRoutes.use("/themes/:id/*", authenticatedSiteRoot);

themeRoutes.get("/themes", authenticatedEditor, async (c) => {
  const seedDir = c.get("seedDir");
  if (!seedDir) return apiError(c, 404, "No theme seed directory configured.");
  const kits = await listThemeKits(seedDir);
  return c.json({ ok: true, kits });
});

themeRoutes.post("/themes/import", authenticatedSiteRoot, async (c) => {
  const denied = assertFullAdmin(c);
  if (denied) return denied;
  const seedDir = c.get("seedDir");
  if (!seedDir) return apiError(c, 404, "No theme seed directory configured.");

  try {
    const form = await c.req.parseBody();
    const file = form.file;
    if (!(file instanceof File)) return apiError(c, 400, "Choose a theme kit archive.");
    const limits = c.get("uploadLimits");
    if (file.size > limits.maxTotalBytes) {
      return apiError(c, 413, `Archive exceeds the ${limits.maxTotalBytes}-byte upload limit.`);
    }
    if (!/\.tar\.gz$/i.test(file.name)) {
      return apiError(c, 400, "Theme kit must be a .tar.gz archive.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kit = await importThemeKitArchive(seedDir, bytes);
    return c.json({ ok: true, kit });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not import this theme.");
  }
});

themeRoutes.post("/themes/export", authenticatedSiteRoot, async (c) => {
  const denied = assertFullAdmin(c);
  if (denied) return denied;
  const siteRoot = c.get("requiredSiteRoot");
  if (!siteRoot) return apiError(c, 404, "No site data directory configured.");

  let body: { id?: string; name?: string; stack?: string; version?: number };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return apiError(c, 400, "Request body must be JSON.");
  }

  const id = typeof body.id === "string" ? body.id : "";
  const name = typeof body.name === "string" ? body.name : "";
  const stack = body.stack === "custom" ? "custom" : body.stack === "w3" ? "w3" : undefined;
  const version = typeof body.version === "number" ? body.version : undefined;

  try {
    const bytes = await exportThemeKit(siteRoot, { id, name, stack, version });
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="${id}.tar.gz"`,
      },
    });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not export this theme.");
  }
});

themeRoutes.post("/themes/:id/apply", async (c) => {
  const denied = assertFullAdmin(c);
  if (denied) return denied;
  const kitId = c.req.param("id");
  const site = c.get("requiredSite");
  const siteRoot = c.get("requiredSiteRoot");
  const backupDir = c.get("backupDir");
  const seedDir = c.get("seedDir");
  if (!backupDir) return apiError(c, 404, "No site data directory configured.");
  if (!seedDir) return apiError(c, 404, "No theme seed directory configured.");

  let importDemo = false;
  try {
    const body = (await c.req.json().catch(() => ({}))) as { importDemo?: boolean };
    importDemo = body.importDemo === true;
  } catch {
    // empty body is fine
  }

  try {
    const result = await applyThemeKit(siteRoot, backupDir, seedDir, kitId, { importDemo });
    site.invalidateListing();
    const doc = await site.flatten();
    if (!doc) return apiError(c, 400, "The site did not flatten after applying the theme.");
    const snapshot = await site.publishedSnapshot();
    return c.json({
      ok: true,
      ...result,
      pages: doc.pages.length,
      ...(snapshot ? { snapshot } : {}),
    });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not apply this theme.");
  }
});

themeRoutes.post("/themes/:id/reset-demo", async (c) => {
  const denied = assertFullAdmin(c);
  if (denied) return denied;
  const kitId = c.req.param("id");
  const site = c.get("requiredSite");
  const siteRoot = c.get("requiredSiteRoot");
  const backupDir = c.get("backupDir");
  const seedDir = c.get("seedDir");
  if (!backupDir) return apiError(c, 404, "No site data directory configured.");
  if (!seedDir) return apiError(c, 404, "No theme seed directory configured.");

  try {
    const result = await resetThemeDemo(siteRoot, backupDir, seedDir, kitId);
    site.invalidateListing();
    const doc = await site.flatten();
    if (!doc) return apiError(c, 400, "The site did not flatten after removing demo content.");
    const snapshot = await site.publishedSnapshot();
    return c.json({
      ok: true,
      ...result,
      pages: doc.pages.length,
      ...(snapshot ? { snapshot } : {}),
    });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not reset demo content.");
  }
});
