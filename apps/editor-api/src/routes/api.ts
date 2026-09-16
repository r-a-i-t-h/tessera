import { Hono } from "hono";
import { requireEditor } from "../access/editor.js";
import { isResponse } from "../http.js";

/** Placeholder mutation used until content CRUD lands. Always permission-checked. */
export const apiRoutes = new Hono();

apiRoutes.post("/ping", (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;
  return c.json({ ok: true, username: user.username });
});
