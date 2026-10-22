import { Hono } from "hono";
import { assertFullAdmin } from "../access/level.js";
import { apiError } from "../http.js";
import { authenticatedEditor, authenticatedSiteRoot } from "../middleware/editor-site.js";
import { applyThemeKit, listThemeKits, resetThemeDemo } from "../site/theme-kit.js";

export const themeRoutes = new Hono();
themeRoutes.use("/themes/:id/*", authenticatedSiteRoot);

themeRoutes.get("/themes", authenticatedEditor, async (c) => {
  const seedDir = c.get("seedDir");
  if (!seedDir) return apiError(c, 404, "No theme seed directory configured.");
  const kits = await listThemeKits(seedDir);
  return c.json({ ok: true, kits });
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
