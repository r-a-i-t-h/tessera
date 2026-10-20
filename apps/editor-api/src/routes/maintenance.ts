import { Hono } from "hono";
import {
  buildMaintenanceReport,
  createDefaultRegistry,
} from "@r-a-i-t-h/tessera-renderer";
import { registerExtras } from "@r-a-i-t-h/tessera-extras";
import { apiError } from "../http.js";
import { authenticatedSite } from "../middleware/editor-site.js";

export const maintenanceRoutes = new Hono();
maintenanceRoutes.use("/maintenance", authenticatedSite);

/** Site-wide health reports for the editor Maintenance section. */
maintenanceRoutes.get("/maintenance", async (c) => {
  const site = c.get("requiredSite");
  const doc = await site.flatten();
  if (!doc) return apiError(c, 400, "The site did not flatten.");

  const registry = createDefaultRegistry(registerExtras);
  const report = buildMaintenanceReport(doc, registry);
  return c.json({ ok: true, ...report });
});
