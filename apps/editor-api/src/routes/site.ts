import { Hono } from "hono";
import { requireEditor } from "../access/editor.js";
import { apiError, isResponse } from "../http.js";
import { reseedSite } from "../site/backup.js";
import { writeBlankSite } from "../site/blank.js";

export const siteRoutes = new Hono();

/** Create a shell, master layout, and first page in an empty instance. */
siteRoutes.post("/site/init", async (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;
  const site = c.get("site");
  const siteRoot = c.get("siteRoot");
  if (!site || !siteRoot) return apiError(c, 404, "No site data directory configured.");

  try {
    await writeBlankSite(siteRoot);
    const doc = await site.flatten();
    if (!doc) return apiError(c, 400, "The new site did not flatten.");
    const snapshot = await site.publishedSnapshot();
    return c.json({
      ok: true,
      pages: doc.pages.length,
      ...(snapshot ? { snapshot } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start a site.";
    const status = message.includes("already has records") ? 409 : 400;
    return apiError(c, status, message);
  }
});

/** Replace the open site with the starter. Editors stay. A safety archive is written first. */
siteRoutes.post("/site/reseed", async (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;
  const site = c.get("site");
  const siteRoot = c.get("siteRoot");
  const backupDir = c.get("backupDir");
  if (!site || !siteRoot || !backupDir) return apiError(c, 404, "No site data directory configured.");

  try {
    const result = await reseedSite(siteRoot, backupDir);
    const doc = await site.flatten();
    if (!doc) return apiError(c, 400, "The new site did not flatten.");
    const snapshot = await site.publishedSnapshot();
    return c.json({
      ok: true,
      ...result,
      pages: doc.pages.length,
      ...(snapshot ? { snapshot } : {}),
    });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not re-seed this site.");
  }
});
