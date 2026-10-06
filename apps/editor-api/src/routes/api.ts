import { Hono } from "hono";
import { authenticatedEditor } from "../middleware/editor-site.js";

/** Placeholder mutation used until content CRUD lands. Always permission-checked. */
export const apiRoutes = new Hono();
apiRoutes.use("/ping", authenticatedEditor);

apiRoutes.post("/ping", (c) => {
  const user = c.get("editor");
  return c.json({ ok: true, username: user.username });
});
