import { join } from "node:path";
import { Hono } from "hono";
import { requireEditor } from "../access/editor.js";
import { apiError, isResponse } from "../http.js";
import { AssetLibrary, type UploadFile } from "../site/library-store.js";
import type { SiteStore } from "../site/store.js";

export const libraryRoutes = new Hono();

function libraryFor(site: SiteStore, siteRoot: string | undefined): AssetLibrary {
  const root = siteRoot ?? join(site.siteDir, "..");
  return new AssetLibrary(site, join(root, "files"));
}

libraryRoutes.get("/library", async (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;
  const site = c.get("site");
  if (!site) return apiError(c, 404, "No site data directory configured.");
  const listing = await libraryFor(site, c.get("siteRoot")).list();
  return c.json({ ok: true, ...listing });
});

libraryRoutes.post("/library/folders", async (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;
  const site = c.get("site");
  if (!site) return apiError(c, 404, "No site data directory configured.");
  const body = (await c.req.json().catch(() => null)) as { id?: unknown; parentId?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) return apiError(c, 400, "A folder needs an id.");
  const parentId = typeof body?.parentId === "string" && body.parentId ? body.parentId : undefined;
  try {
    const created = await libraryFor(site, c.get("siteRoot")).createFolder(id, parentId);
    return c.json({ ok: true, ...created });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not create the folder.");
  }
});

libraryRoutes.patch("/library/folders/:id", async (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;
  const site = c.get("site");
  if (!site) return apiError(c, 404, "No site data directory configured.");
  const body = (await c.req.json().catch(() => null)) as {
    parentId?: unknown;
    sort?: unknown;
  } | null;
  try {
    const updated = await libraryFor(site, c.get("siteRoot")).patchFolder(c.req.param("id"), {
      ...(body && "parentId" in body ? { parentId: typeof body.parentId === "string" ? body.parentId : null } : {}),
      ...(typeof body?.sort === "number" ? { sort: body.sort } : {}),
    });
    return c.json({ ok: true, ...updated });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not update the folder.");
  }
});

libraryRoutes.delete("/library/folders/:id", async (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;
  const site = c.get("site");
  if (!site) return apiError(c, 404, "No site data directory configured.");
  try {
    const deleted = await libraryFor(site, c.get("siteRoot")).deleteFolder(c.req.param("id"));
    return c.json({ ok: true, ...deleted });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not delete the folder.");
  }
});

libraryRoutes.post("/library/upload", async (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;
  const site = c.get("site");
  if (!site) return apiError(c, 404, "No site data directory configured.");
  const form = await c.req.parseBody({ all: true });
  const files = await readUploads(form.file, form.path);
  if (!files.length) return apiError(c, 400, "Choose at least one file.");
  const folderId = stringField(form.folderId);
  const folderTitle = stringField(form.folderTitle);
  const parentId = stringField(form.parentId);
  try {
    const result = await libraryFor(site, c.get("siteRoot")).upload({
      files,
      ...(folderId ? { folderId } : {}),
      ...(folderTitle ? { folderTitle } : {}),
      ...(parentId ? { parentId } : {}),
    });
    return c.json({ ok: true, ...result });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not add those files.");
  }
});

libraryRoutes.patch("/library/assets/:id", async (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;
  const site = c.get("site");
  if (!site) return apiError(c, 404, "No site data directory configured.");
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const updated = await libraryFor(site, c.get("siteRoot")).patchAsset(c.req.param("id"), {
      ...(typeof body?.name === "string" ? { name: body.name } : {}),
      ...(typeof body?.title === "string" ? { title: body.title } : {}),
      ...(typeof body?.alt === "string" ? { alt: body.alt } : {}),
      ...(typeof body?.caption === "string" ? { caption: body.caption } : {}),
      ...(body && "folderId" in body ? { folderId: typeof body.folderId === "string" ? body.folderId : null } : {}),
      ...(typeof body?.sort === "number" ? { sort: body.sort } : {}),
    });
    return c.json({ ok: true, ...updated });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not update the file.");
  }
});

libraryRoutes.delete("/library/assets/:id", async (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;
  const site = c.get("site");
  if (!site) return apiError(c, 404, "No site data directory configured.");
  try {
    const deleted = await libraryFor(site, c.get("siteRoot")).deleteAsset(c.req.param("id"));
    return c.json({ ok: true, ...deleted });
  } catch (err) {
    return apiError(c, 400, err instanceof Error ? err.message : "Could not delete the file.");
  }
});

libraryRoutes.get("/library/assets/:id/file", async (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;
  const site = c.get("site");
  if (!site) return apiError(c, 404, "No site data directory configured.");
  const file = await libraryFor(site, c.get("siteRoot")).readOriginal(c.req.param("id"));
  if (!file) return apiError(c, 404, "File not found.");
  return c.body(new Uint8Array(file.bytes), 200, {
    "Content-Type": file.type,
    "Content-Disposition": `inline; filename="${file.filename.replace(/"/g, "")}"`,
  });
});

libraryRoutes.get("/library/assets/:id/thumb", async (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;
  const site = c.get("site");
  if (!site) return apiError(c, 404, "No site data directory configured.");
  const bytes = await libraryFor(site, c.get("siteRoot")).readThumb(c.req.param("id"));
  if (!bytes) return apiError(c, 404, "No thumbnail.");
  return c.body(new Uint8Array(bytes), 200, { "Content-Type": "image/webp" });
});

function stringField(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

async function readUploads(fileField: unknown, pathField: unknown): Promise<UploadFile[]> {
  const files = asFiles(fileField);
  const paths = asStrings(pathField);
  const out: UploadFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    out.push({
      filename: file.name,
      relativePath: paths[i] || file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
  }
  return out;
}

function asFiles(value: unknown): File[] {
  if (value instanceof File) return [value];
  if (Array.isArray(value)) return value.filter((item): item is File => item instanceof File);
  return [];
}

function asStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.map((item) => (typeof item === "string" ? item : ""));
  return [];
}
