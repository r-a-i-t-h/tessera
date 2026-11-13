import { Hono } from "hono";
import { apiError } from "../http.js";
import { authenticatedSite } from "../middleware/editor-site.js";
import { isReferenceSitePath } from "../site/paths.js";

export const renderRoutes = new Hono();
renderRoutes.use("/render", authenticatedSite);
renderRoutes.use("/publish", authenticatedSite);
renderRoutes.use("/publish/pages", authenticatedSite);

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
    const origin = published.doc?.site.origin?.trim();
    return c.json({
      ok: true,
      pages: published.doc?.pages.length ?? 0,
      dist: published.dist,
      ...(published.installed ? { installed: published.installed } : {}),
      ...(origin ? { origin } : {}),
    });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not publish the site.");
  }
});

/** Write selected page HTML into `publish/`; optionally copy those paths to `publishTo`. */
renderRoutes.post("/publish/pages", async (c) => {
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

  const body: unknown = await c.req.json().catch(() => ({}));
  const rawIds = body && typeof body === "object" && !Array.isArray(body) ? (body as { pageIds?: unknown }).pageIds : undefined;
  const pageIds = Array.isArray(rawIds)
    ? rawIds.filter((id): id is string => typeof id === "string" && id.trim() !== "")
    : [];
  const install =
    body && typeof body === "object" && !Array.isArray(body) ? (body as { install?: unknown }).install === true : false;
  const heroAssetId =
    body && typeof body === "object" && !Array.isArray(body) && typeof (body as { heroAssetId?: unknown }).heroAssetId === "string"
      ? (body as { heroAssetId: string }).heroAssetId
      : undefined;

  try {
    const published = await site.publishPageIds(pageIds, { install, heroAssetId });
    return c.json({
      ok: true,
      paths: published.paths,
      ...(published.installed ? { installed: published.installed } : {}),
    });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not publish those pages.");
  }
});
