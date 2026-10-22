import type { Context } from "hono";
import type { UserRecord } from "./model.js";

export function apiError(
  c: Context,
  status: 400 | 401 | 403 | 404 | 409 | 413 | 429,
  message: string,
): Response {
  return c.json({ error: message }, status);
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

export function publicUser(user: UserRecord): {
  username: string;
  createdAt: string;
  restrictAccessLevel?: "editor";
} {
  return {
    username: user.username,
    createdAt: user.createdAt,
    ...(user.restrictAccessLevel === "editor" ? { restrictAccessLevel: "editor" as const } : {}),
  };
}

export type ManagedUser = {
  username: string;
  createdAt: string;
  disabled: boolean;
  restrictAccessLevel?: "editor";
};

export function managedUser(user: UserRecord): ManagedUser {
  return {
    username: user.username,
    createdAt: user.createdAt,
    disabled: user.disabled === true,
    ...(user.restrictAccessLevel === "editor" ? { restrictAccessLevel: "editor" as const } : {}),
  };
}
