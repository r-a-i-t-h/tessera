import { Hono } from "hono";
import { apiError } from "../http.js";
import { authenticatedSite } from "../middleware/editor-site.js";
import { isReferenceSitePath } from "../site/paths.js";

export const renderRoutes = new Hono();
renderRoutes.use("/render", authenticatedSite);
renderRoutes.use("/publish", authenticatedSite);

/** Flatten every record into the snapshot the preview host is serving. */
renderRoutes.post("/render", async (c) => {
  const site = c.get("requiredSite");

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
    const rebuilt = await site.rebuild();
    if (!rebuilt.doc) {
      return apiError(c, 400, "Nothing to render yet. This site needs a layout and at least one page.");
    }
    return c.json({
      ok: true,
      pages: rebuilt.doc.pages.length,
      ...(rebuilt.snapshot ? { snapshot: rebuilt.snapshot } : {}),
    });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not render the site.");
  }
});

/** Write the copyable `publish/` tree. Leaves the preview where the last edit put it. */
renderRoutes.post("/publish", async (c) => {
  const site = c.get("requiredSite");

  const siteRoot = c.get("siteRoot");
  if (
    (siteRoot && isReferenceSitePath(siteRoot)) ||
    (site.flattenOut && isReferenceSitePath(site.flattenOut))
  ) {
    return apiError(
      c,
      400,
      "Publish the instance the preview is serving. Folders under sites/ stay reference material.",
    );
  }

  try {
    const published = await site.publish();
    return c.json({
      ok: true,
      pages: published.doc?.pages.length ?? 0,
      dist: published.dist,
      ...(published.installed ? { installed: published.installed } : {}),
    });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not publish the site.");
  }
});
