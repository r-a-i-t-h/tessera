import { Hono } from "hono";
import { requireEditor } from "../access/editor.js";
import { apiError, isResponse } from "../http.js";
import { isRecordId, isRecordKind, KIND_LABELS, RECORD_KINDS } from "../site/kinds.js";

export const recordRoutes = new Hono();

recordRoutes.get("/records", async (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;
  const site = c.get("site");
  if (!site) return apiError(c, 404, "No site data directory configured.");
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

recordRoutes.get("/records/:kind/:id", async (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;
  const site = c.get("site");
  if (!site) return apiError(c, 404, "No site data directory configured.");

  const kind = c.req.param("kind");
  const id = c.req.param("id");
  try {
    if (kind === "site") {
      return c.json({ ok: true, kind, id, data: await site.readSite() });
    }
    if (kind === "nav") {
      return c.json({ ok: true, kind, id: "nav", data: await site.readNav() });
    }
    if (!isRecordKind(kind) || !isRecordId(id)) {
      return apiError(c, 400, "Unknown record kind or invalid id.");
    }
    const data = await site.read(kind, id);
    const layout = kind === "content" ? await site.pageLayoutHint(data) : undefined;
    return c.json({ ok: true, kind, id, data, ...(layout ? { layout } : {}) });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return apiError(c, 404, "Record not found.");
    return apiError(c, 400, err instanceof Error ? err.message : "Could not read record.");
  }
});

recordRoutes.put("/records/:kind/:id", async (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;
  const site = c.get("site");
  if (!site) return apiError(c, 404, "No site data directory configured.");

  const kind = c.req.param("kind");
  const id = c.req.param("id");
  const body = await readData(c);
  if (body === undefined) return apiError(c, 400, "JSON body with data is required.");

  try {
    if (kind === "site") {
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return apiError(c, 400, "Site data must be a mapping.");
      }
      await site.writeSite(body as Record<string, unknown>);
      return c.json({ ok: true, kind, id });
    }
    if (kind === "nav") {
      await site.writeNav(body);
      return c.json({ ok: true, kind, id: "nav" });
    }
    if (!isRecordKind(kind) || !isRecordId(id)) {
      return apiError(c, 400, "Unknown record kind or invalid id.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return apiError(c, 400, "Record data must be a mapping.");
    }
    const data = body as Record<string, unknown>;
    if (data.id !== undefined && data.id !== id) {
      return apiError(c, 400, "Id is the filename and cannot be changed here.");
    }
    await site.write(kind, id, data);
    return c.json({ ok: true, kind, id });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not save record.");
  }
});

async function readData(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    const json = (await c.req.json()) as { data?: unknown };
    return json.data;
  } catch {
    return undefined;
  }
}
