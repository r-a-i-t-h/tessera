import type { MiddlewareHandler } from "hono";
import { requireEditor } from "../access/editor.js";
import { apiError, isResponse } from "../http.js";

export const authenticatedEditor: MiddlewareHandler = async (c, next) => {
  const editor = requireEditor(c);
  if (isResponse(editor)) return editor;
  c.set("editor", editor);
  await next();
};

export const authenticatedSite: MiddlewareHandler = async (c, next) => {
  const editor = requireEditor(c);
  if (isResponse(editor)) return editor;
  const site = c.get("site");
  if (!site) return apiError(c, 404, "No site data directory configured.");
  c.set("editor", editor);
  c.set("requiredSite", site);
  await next();
};

export const authenticatedSiteRoot: MiddlewareHandler = async (c, next) => {
  const editor = requireEditor(c);
  if (isResponse(editor)) return editor;
  const site = c.get("site");
  const siteRoot = c.get("siteRoot");
  if (!site || !siteRoot) return apiError(c, 404, "No site data directory configured.");
  c.set("editor", editor);
  c.set("requiredSite", site);
  c.set("requiredSiteRoot", siteRoot);
  await next();
};
