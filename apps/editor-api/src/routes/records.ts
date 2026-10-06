import { Hono } from "hono";
import { apiError } from "../http.js";
import { authenticatedSite } from "../middleware/editor-site.js";
import { AuthoredRecordError } from "../site/authored-schema.js";
import { isRecordId, isRecordKind, KIND_LABELS, RECORD_KINDS, type RecordKind } from "../site/kinds.js";

export const recordRoutes = new Hono();
recordRoutes.use("/records", authenticatedSite);
recordRoutes.use("/records/*", authenticatedSite);

recordRoutes.get("/records", async (c) => {
  const site = c.get("requiredSite");
  const records = await site.list();
  return c.json({
    ok: true,
    kinds: [
      { kind: "site", label: "Site" },
      { kind: "nav", label: "Navigation" },
      ...RECORD_KINDS.map((kind) => ({ kind, label: KIND_LABELS[kind] })),
    ],
    records,
  });
});

recordRoutes.get("/records/:kind/:id/history/:index", async (c) => {
  const site = c.get("requiredSite");

  const kind = c.req.param("kind");
  const id = c.req.param("id");
  const index = Number(c.req.param("index"));
  if (kind !== "content" || !isRecordId(id)) {
    return apiError(c, 400, "History is kept per content page.");
  }
  if (!Number.isInteger(index) || index < 0) {
    return apiError(c, 400, "History index must be a non-negative integer.");
  }
  try {
    const entry = await site.pageHistoryEntry(id, index);
    if (!entry) return apiError(c, 404, "History entry not found.");
    return c.json({ ok: true, kind, id, index, ...entry });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not read history.");
  }
});

recordRoutes.get("/records/:kind/:id", async (c) => {
  const site = c.get("requiredSite");

  const kind = c.req.param("kind");
  const id = c.req.param("id");
  try {
    const meta = await recordMeta(site);
    if (kind === "site") {
      return c.json({
        ok: true,
        kind,
        id,
        data: await site.readSite(),
        raw: await site.readRaw("site", id),
        ...site.fileRef("site", id),
        ...meta,
      });
    }
    if (kind === "nav") {
      return c.json({
        ok: true,
        kind,
        id: "nav",
        data: await site.readNav(),
        raw: await site.readRaw("nav", "nav"),
        ...site.fileRef("nav", "nav"),
        ...meta,
      });
    }
    if (!isRecordKind(kind) || !isRecordId(id)) {
      return apiError(c, 400, "Unknown record kind or invalid id.");
    }
    const data = await site.read(kind, id);
    const layout = kind === "content" ? await site.pageLayoutHint(data) : undefined;
    const history = kind === "content" ? await site.pageHistory(id) : undefined;
    return c.json({
      ok: true,
      kind,
      id,
      data,
      raw: await site.readRaw(kind, id),
      ...site.fileRef(kind, id),
      ...meta,
      ...(layout ? { layout } : {}),
      ...(history ? { history } : {}),
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return apiError(c, 404, "Record not found.");
    return apiError(c, 400, err instanceof Error ? err.message : "Could not read record.");
  }
});

recordRoutes.put("/records/:kind/:id", async (c) => {
  const site = c.get("requiredSite");

  const kind = c.req.param("kind");
  const id = c.req.param("id");
  const body = await readBody(c);
  if (!body) return apiError(c, 400, "JSON body with data or raw is required.");
  if (body.raw !== undefined && body.data !== undefined) {
    return apiError(c, 400, "Send raw or data, not both.");
  }

  try {
    if (typeof body.raw === "string") {
      const target = rawTarget(kind, id);
      if (!target) return apiError(c, 400, "Unknown record kind or invalid id.");
      const saved = await site.writeRaw(target, id, body.raw);
      return c.json({ ok: true, kind, id: target === "nav" ? "nav" : id, ...saved });
    }
    if (kind === "site") {
      if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
        return apiError(c, 400, "Site data must be a mapping.");
      }
      const saved = await site.writeSite(body.data as Record<string, unknown>);
      return c.json({ ok: true, kind, id, ...saved });
    }
    if (kind === "nav") {
      const saved = await site.writeNav(body.data);
      return c.json({ ok: true, kind, id: "nav", ...saved });
    }
    if (!isRecordKind(kind) || !isRecordId(id)) {
      return apiError(c, 400, "Unknown record kind or invalid id.");
    }
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
      return apiError(c, 400, "Record data must be a mapping.");
    }
    const data = body.data as Record<string, unknown>;
    if (data.id !== undefined && data.id !== id) {
      return apiError(c, 400, "Id is the filename and cannot be changed here.");
    }
    const saved = await site.write(kind, id, data);
    return c.json({ ok: true, kind, id, ...saved });
  } catch (err) {
    if (err instanceof AuthoredRecordError) {
      return c.json({
        error: err.message,
        kind: err.kind,
        id: err.id,
        field: err.field,
      }, 400);
    }
    return apiError(c, 400, err instanceof Error ? err.message : "Could not save record.");
  }
});

function rawTarget(kind: string, id: string): RecordKind | "site" | "nav" | undefined {
  if (kind === "site" || kind === "nav") return kind;
  if (isRecordKind(kind) && isRecordId(id)) return kind;
  return undefined;
}

async function recordMeta(site: {
  currentSchemaVersion(): Promise<number>;
  publishedSnapshot(): Promise<{ hash: string; file: string } | undefined>;
}): Promise<{ schemaVersion: number; snapshot?: { hash: string; file: string } }> {
  const schemaVersion = await site.currentSchemaVersion();
  const snapshot = await site.publishedSnapshot();
  return { schemaVersion, ...(snapshot ? { snapshot } : {}) };
}

async function readBody(c: {
  req: { json: () => Promise<unknown> };
}): Promise<{ data?: unknown; raw?: string } | undefined> {
  try {
    const json = (await c.req.json()) as { data?: unknown; raw?: unknown };
    if (json.raw !== undefined && typeof json.raw !== "string") return undefined;
    if (json.data === undefined && json.raw === undefined) return undefined;
    return { data: json.data, raw: typeof json.raw === "string" ? json.raw : undefined };
  } catch {
    return undefined;
  }
}
