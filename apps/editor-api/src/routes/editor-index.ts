import { Hono } from "hono";
import { filterRecordListingForLimitedEditor, isFullAdmin } from "../access/level.js";
import { apiError } from "../http.js";
import { authenticatedSiteRoot } from "../middleware/editor-site.js";
import { buildEditorIndex } from "../site/editor-index.js";
import { datasetStoreForSiteRoot } from "../site/dataset-store.js";

export const editorIndexRoutes = new Hono();
editorIndexRoutes.use("/editor-index", authenticatedSiteRoot);

editorIndexRoutes.get("/editor-index", async (c) => {
  const site = c.get("requiredSite");
  const editor = c.get("editor");
  if (!editor) return apiError(c, 401, "Authentication required.");

  let records = await site.list();
  const admin = isFullAdmin(editor);
  if (!admin) {
    records = filterRecordListingForLimitedEditor(records);
  }

  const siteRoot = c.get("siteRoot");
  if (!siteRoot) return apiError(c, 404, "No site data directory configured.");

  const datasetStore = datasetStoreForSiteRoot(siteRoot);
  const datasets = admin ? await datasetStore.list() : [];

  let users: string[] = [];
  if (admin) {
    const userStore = c.get("users");
    users = userStore.listUsers().map((u) => u.username);
  }

  const payload = buildEditorIndex({
    records,
    datasets,
    users,
    admin,
    siteListingVersion: site.listingVersion(),
    datasetListingVersion: datasetStore.listingVersion(),
  });

  const etag = `"${payload.version}"`;
  if (c.req.header("If-None-Match") === etag) {
    return c.body(null, 304, { ETag: etag });
  }

  return c.json(payload, 200, { ETag: etag });
});
