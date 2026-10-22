import { Hono } from "hono";
import { assertFullAdmin } from "../access/level.js";
import { apiError } from "../http.js";
import { authenticatedSiteRoot } from "../middleware/editor-site.js";
import { datasetStoreForSiteRoot, ValidationError } from "../site/dataset-store.js";
import { isRecordId } from "../site/kinds.js";
import type { SiteStore } from "../site/store.js";

async function rebuildPreview(c: { get: (key: "site") => SiteStore | undefined }): Promise<void> {
  const site = c.get("site");
  if (site) await site.rebuild();
}

export const datasetRoutes = new Hono();
datasetRoutes.use("/datasets", authenticatedSiteRoot);
datasetRoutes.use("/datasets/*", authenticatedSiteRoot);

function store(c: { get: (key: "siteRoot") => string | undefined }) {
  const siteRoot = c.get("siteRoot");
  if (!siteRoot) throw new Error("No site root.");
  return datasetStoreForSiteRoot(siteRoot);
}

datasetRoutes.get("/datasets", async (c) => {
  try {
    const datasets = await store(c).list();
    return c.json({ ok: true, datasets });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not list datasets.");
  }
});

datasetRoutes.post("/datasets", async (c) => {
  const denied = assertFullAdmin(c);
  if (denied) return denied;
  const body: unknown = await c.req.json().catch(() => ({}));
  const id = body && typeof body === "object" && "id" in body ? String((body as { id: unknown }).id ?? "").trim() : "";
  const title =
    body && typeof body === "object" && "title" in body ? String((body as { title: unknown }).title ?? "") : "";
  if (!isRecordId(id)) return apiError(c, 400, "Dataset id is invalid.");
  try {
    const file = await store(c).create(id, title);
    await rebuildPreview(c);
    return c.json({ ok: true, file });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not create dataset.");
  }
});

datasetRoutes.get("/datasets/:id/roots", async (c) => {
  const id = c.req.param("id");
  if (!isRecordId(id)) return apiError(c, 400, "Dataset id is invalid.");
  try {
    const records = await store(c).rootRecords(id);
    return c.json({ ok: true, id, records });
  } catch (err) {
    return apiError(c, 404, err instanceof Error ? err.message : "Dataset not found.");
  }
});

datasetRoutes.get("/datasets/:id", async (c) => {
  const id = c.req.param("id");
  if (!isRecordId(id)) return apiError(c, 400, "Dataset id is invalid.");
  try {
    const { file, issues } = await store(c).read(id);
    const issueList = [...issues.entries()].map(([uid, list]) => ({ uid, issues: list }));
    return c.json({ ok: true, file, recordIssues: issueList });
  } catch (err) {
    return apiError(c, 404, err instanceof Error ? err.message : "Dataset not found.");
  }
});

datasetRoutes.put("/datasets/:id", async (c) => {
  const id = c.req.param("id");
  if (!isRecordId(id)) return apiError(c, 400, "Dataset id is invalid.");
  const body: unknown = await c.req.json().catch(() => ({}));
  const title =
    body && typeof body === "object" && "title" in body ? String((body as { title: unknown }).title ?? "") : "";
  try {
    const file = await store(c).updateTitle(id, title);
    await rebuildPreview(c);
    return c.json({ ok: true, file });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not update dataset.");
  }
});

datasetRoutes.put("/datasets/:id/view", async (c) => {
  const id = c.req.param("id");
  if (!isRecordId(id)) return apiError(c, 400, "Dataset id is invalid.");
  const body: unknown = await c.req.json().catch(() => ({}));
  const columns =
    body && typeof body === "object" && Array.isArray((body as { columns?: unknown }).columns)
      ? ((body as { columns: unknown[] }).columns.filter((c): c is string => typeof c === "string"))
      : [];
  const displayName =
    body && typeof body === "object" && "displayName" in body
      ? String((body as { displayName?: unknown }).displayName ?? "")
      : undefined;
  try {
    const file = await store(c).updateView(id, { columns, displayName });
    await rebuildPreview(c);
    return c.json({ ok: true, file });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not update view.");
  }
});

datasetRoutes.put("/datasets/:id/schema", async (c) => {
  const id = c.req.param("id");
  if (!isRecordId(id)) return apiError(c, 400, "Dataset id is invalid.");
  const body: unknown = await c.req.json().catch(() => ({}));
  const schema = body && typeof body === "object" ? (body as { schema?: unknown }).schema : undefined;
  try {
    const { file, summary } = await store(c).updateSchema(id, schema ?? { fields: [] });
    await rebuildPreview(c);
    return c.json({ ok: true, file, summary });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not update schema.");
  }
});

datasetRoutes.post("/datasets/:id/records", async (c) => {
  const id = c.req.param("id");
  if (!isRecordId(id)) return apiError(c, 400, "Dataset id is invalid.");
  const body: unknown = await c.req.json().catch(() => ({}));
  const record = body && typeof body === "object" ? (body as { record?: unknown }).record : undefined;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return apiError(c, 400, "Record body is required.");
  }
  try {
    const file = await store(c).appendRecord(id, record as Record<string, unknown>);
    await rebuildPreview(c);
    return c.json({ ok: true, file });
  } catch (err) {
    if (err instanceof ValidationError) return c.json({ ok: false, error: err.message, issues: err.issues }, 400);
    return apiError(c, 400, err instanceof Error ? err.message : "Could not add record.");
  }
});

datasetRoutes.put("/datasets/:id/records/:uid", async (c) => {
  const id = c.req.param("id");
  const uid = Number(c.req.param("uid"));
  if (!isRecordId(id) || !Number.isInteger(uid) || uid < 1) return apiError(c, 400, "Invalid dataset or record uid.");
  const body: unknown = await c.req.json().catch(() => ({}));
  const record = body && typeof body === "object" ? (body as { record?: unknown }).record : undefined;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return apiError(c, 400, "Record body is required.");
  }
  try {
    const file = await store(c).replaceRecord(id, uid, record as Record<string, unknown>);
    await rebuildPreview(c);
    return c.json({ ok: true, file });
  } catch (err) {
    if (err instanceof ValidationError) return c.json({ ok: false, error: err.message, issues: err.issues }, 400);
    return apiError(c, 400, err instanceof Error ? err.message : "Could not save record.");
  }
});

datasetRoutes.patch("/datasets/:id/records", async (c) => {
  const id = c.req.param("id");
  if (!isRecordId(id)) return apiError(c, 400, "Dataset id is invalid.");
  const body: unknown = await c.req.json().catch(() => ({}));
  const items =
    body && typeof body === "object" && Array.isArray((body as { items?: unknown }).items)
      ? (body as { items: unknown[] }).items
      : [];
  const parsed: { uid: number; record: Record<string, unknown> }[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") return apiError(c, 400, "Each patch item must be an object.");
    const uid = Number((item as { uid?: unknown }).uid);
    const record = (item as { record?: unknown }).record;
    if (!Number.isInteger(uid) || uid < 1) return apiError(c, 400, "Each patch item needs a uid.");
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      return apiError(c, 400, "Each patch item needs a record.");
    }
    parsed.push({ uid, record: record as Record<string, unknown> });
  }
  try {
    const file = await store(c).patchRecords(id, parsed);
    await rebuildPreview(c);
    return c.json({ ok: true, file });
  } catch (err) {
    if (err instanceof ValidationError) return c.json({ ok: false, error: err.message, issues: err.issues }, 400);
    return apiError(c, 400, err instanceof Error ? err.message : "Could not patch records.");
  }
});

datasetRoutes.delete("/datasets/:id/records/:uid", async (c) => {
  const id = c.req.param("id");
  const uid = Number(c.req.param("uid"));
  if (!isRecordId(id) || !Number.isInteger(uid) || uid < 1) return apiError(c, 400, "Invalid dataset or record uid.");
  try {
    const file = await store(c).deleteRecord(id, uid);
    await rebuildPreview(c);
    return c.json({ ok: true, file });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not delete record.");
  }
});

datasetRoutes.delete("/datasets/:id", async (c) => {
  const id = c.req.param("id");
  if (!isRecordId(id)) return apiError(c, 400, "Dataset id is invalid.");
  try {
    await store(c).deleteDataset(id);
    await rebuildPreview(c);
    return c.json({ ok: true });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not delete dataset.");
  }
});
