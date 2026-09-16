import type { Context } from "hono";
import type { UserRecord } from "./model.js";

export function apiError(
  c: Context,
  status: 400 | 401 | 403 | 404 | 409 | 429,
  message: string,
): Response {
  return c.json({ error: message }, status);
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

export function publicUser(user: UserRecord): { username: string; createdAt: string } {
  return { username: user.username, createdAt: user.createdAt };
}
