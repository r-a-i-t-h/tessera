import type { Context } from "hono";
import { apiError } from "../http.js";
import type { UserRecord } from "../model.js";

/**
 * All-or-nothing editor access: any authenticated user may do everything.
 * Granular ACL will replace the body of this helper later; keep calling it
 * from every editing route so that change is local.
 */
export function requireEditor(c: Context): UserRecord | Response {
  const user = c.get("user");
  if (!user) return apiError(c, 401, "Authentication required");
  return user;
}
