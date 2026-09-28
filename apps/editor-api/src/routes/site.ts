import { Hono } from "hono";
import { requireEditor } from "../access/editor.js";
import { apiError, isResponse } from "../http.js";
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
