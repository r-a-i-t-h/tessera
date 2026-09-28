import { Hono } from "hono";
import { requireEditor } from "../access/editor.js";
import { apiError, isResponse } from "../http.js";
import { isReferenceSitePath } from "../site/paths.js";

export const renderRoutes = new Hono();

/** Flatten every record into the snapshot the preview host is serving. */
renderRoutes.post("/render", async (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;
  const site = c.get("site");
  if (!site) return apiError(c, 404, "No site data directory configured.");

  const siteRoot = c.get("siteRoot");
  if (
    (siteRoot && isReferenceSitePath(siteRoot)) ||
    (site.flattenOut && isReferenceSitePath(site.flattenOut))
  ) {
    return apiError(
      c,
      400,
      "Render the instance the preview is serving. Folders under sites/ stay reference material.",
    );
  }

  try {
    const doc = await site.flatten();
    if (!doc) {
      return apiError(c, 400, "Nothing to render yet. This site needs a layout and at least one page.");
    }
    const snapshot = await site.publishedSnapshot();
    return c.json({
      ok: true,
      pages: doc.pages.length,
      ...(snapshot ? { snapshot } : {}),
    });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not render the site.");
  }
});
