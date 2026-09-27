import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

/** Session cookie for the editor at the hostname root. */
export const SESSION_COOKIE = "tessera_session";

/** Bearer token or session cookie — same resolution as `loadUser`. */
export function requestSessionToken(c: Context): string | undefined {
  const header = c.req.header("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    return token || undefined;
  }
  return getCookie(c, SESSION_COOKIE) || undefined;
}

export const loadUser = createMiddleware(async (c, next) => {
  const sessions = c.get("sessions");
  const users = c.get("users");
  const token = requestSessionToken(c);

  const session = sessions.get(token);
  if (session) {
    const user = users.getUser(session.username);
    if (user) c.set("user", user);
  }

  await next();
});
