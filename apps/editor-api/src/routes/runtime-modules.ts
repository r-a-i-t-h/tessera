import { join } from "node:path";
import { Hono } from "hono";
import { apiError } from "../http.js";
import { authenticatedSiteRoot } from "../middleware/editor-site.js";
import { RuntimeModuleLibrary } from "../site/runtime-module-store.js";
import type { SiteStore } from "../site/store.js";

export const runtimeModuleRoutes = new Hono();
runtimeModuleRoutes.use("/runtime-modules", authenticatedSiteRoot);
runtimeModuleRoutes.use("/runtime-modules/*", authenticatedSiteRoot);

function libraryFor(site: SiteStore, siteRoot: string): RuntimeModuleLibrary {
  return new RuntimeModuleLibrary(site, join(siteRoot, "runtime-modules"));
}

runtimeModuleRoutes.get("/runtime-modules", async (c) => {
  const site = c.get("requiredSite");
  const listing = await libraryFor(site, c.get("requiredSiteRoot")).list();
  return c.json({ ok: true, ...listing });
});

runtimeModuleRoutes.get("/runtime-modules/:id/raw", async (c) => {
  const site = c.get("requiredSite");
  try {
    const text = await libraryFor(site, c.get("requiredSiteRoot")).readText(c.req.param("id"));
    return c.json({ ok: true, text });
  } catch (err) {
    return apiError(c, 404, err instanceof Error ? err.message : "Module not found.");
  }
});

runtimeModuleRoutes.put("/runtime-modules/:id/raw", async (c) => {
  const site = c.get("requiredSite");
  const body = (await c.req.json().catch(() => null)) as { text?: unknown } | null;
  if (typeof body?.text !== "string") return apiError(c, 400, "Body must include text.");
  try {
    const result = await libraryFor(site, c.get("requiredSiteRoot")).writeText(c.req.param("id"), body.text);
    return c.json({ ok: true, snapshot: result.snapshot });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not save module.");
  }
});

runtimeModuleRoutes.post("/runtime-modules/upload", async (c) => {
  const site = c.get("requiredSite");
  try {
    const form = await c.req.parseBody();
    const file = form.file;
    if (!(file instanceof File)) return apiError(c, 400, "Choose a .js or .mjs file.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const id = typeof form.id === "string" ? form.id.trim() : undefined;
    const title = typeof form.title === "string" ? form.title.trim() : undefined;
    const created = await libraryFor(site, c.get("requiredSiteRoot")).upload(
      { filename: file.name, bytes },
      { id, title },
    );
    return c.json({ ok: true, ...created });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Upload failed.");
  }
});

runtimeModuleRoutes.patch("/runtime-modules/:id", async (c) => {
  const site = c.get("requiredSite");
  const body = (await c.req.json().catch(() => null)) as { title?: unknown } | null;
  try {
    const patch: { title?: string | null } = {};
    if (body && "title" in body) {
      patch.title = typeof body.title === "string" ? body.title : body.title === null ? null : undefined;
    }
    const result = await libraryFor(site, c.get("requiredSiteRoot")).patch(c.req.param("id"), patch);
    return c.json({ ok: true, snapshot: result.snapshot });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not update module.");
  }
});

runtimeModuleRoutes.delete("/runtime-modules/:id", async (c) => {
  const site = c.get("requiredSite");
  try {
    const result = await libraryFor(site, c.get("requiredSiteRoot")).delete(c.req.param("id"));
    return c.json({ ok: true, snapshot: result.snapshot });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not delete module.");
  }
});
