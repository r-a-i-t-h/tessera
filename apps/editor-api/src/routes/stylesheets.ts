import type { Context } from "hono";
import { Hono } from "hono";
import { apiError, isResponse } from "../http.js";
import { authenticatedEditor } from "../middleware/editor-site.js";
import { listStylesheets, saveStylesheet, StylesheetError } from "../site/stylesheets.js";

export const stylesheetRoutes = new Hono();
stylesheetRoutes.use("/stylesheets", authenticatedEditor);
stylesheetRoutes.use("/stylesheets/*", authenticatedEditor);

stylesheetRoutes.get("/stylesheets", async (c) => {
  const roots = sheetRoots(c);
  if (isResponse(roots)) return roots;
  const sheets = await listStylesheets(roots.siteRoot, roots.skinDir);
  return c.json({ ok: true, sheets });
});

stylesheetRoutes.put("/stylesheets/:id", async (c) => {
  const roots = sheetRoots(c);
  if (isResponse(roots)) return roots;
  const body: unknown = await c.req.json().catch(() => null);
  const text = body && typeof body === "object" && "text" in body ? (body as { text: unknown }).text : undefined;
  if (typeof text !== "string") return apiError(c, 400, "Send the stylesheet text.");
  try {
    await saveStylesheet(roots.siteRoot, roots.skinDir, c.req.param("id"), text);
  } catch (err) {
    if (err instanceof StylesheetError) return apiError(c, err.status, err.message);
    throw err;
  }
  const sheets = await listStylesheets(roots.siteRoot, roots.skinDir);
  return c.json({ ok: true, sheets });
});

function sheetRoots(c: Context): { siteRoot: string; skinDir: string } | Response {
  const siteRoot = c.get("siteRoot");
  const skinDir = c.get("skinDir");
  if (!siteRoot) return apiError(c, 404, "No site data directory configured.");
  if (!skinDir) return apiError(c, 404, "Skin CSS is not available.");
  return { siteRoot, skinDir };
}
