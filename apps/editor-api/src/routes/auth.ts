import { Hono } from "hono";
import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { requireEditor } from "../access/editor.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { normalizedUsername, usernameError } from "../auth/username.js";
import { apiError, isResponse, publicUser } from "../http.js";
import { clientIp, rateLimit } from "../middleware/rate-limit.js";
import { requestSessionToken, SESSION_COOKIE } from "../middleware/auth.js";

export const authRoutes = new Hono();

const authAttemptLimit = rateLimit({
  name: "auth",
  bucket: (limits) => limits.auth,
  key: authAttemptKeys,
});

const authPasswordLimit = rateLimit({
  name: "auth",
  bucket: (limits) => limits.auth,
  key: (c) => {
    const ip = clientIp(c);
    const user = c.get("user");
    return user ? [`ip:${ip}`, `user:${user.username.toLowerCase()}`] : [`ip:${ip}`];
  },
});

authRoutes.post("/login", authAttemptLimit, async (c) => {
  const users = c.get("users");
  const sessions = c.get("sessions");
  const body = await readAuthRequest(c);
  if (!body.username || !body.password) {
    return apiError(c, 400, "Username and password required.");
  }
  const user = users.resolveUser(body.username);
  if (!user || !(await verifyPassword(body.password, user.passwordHash, user.passwordSalt))) {
    return apiError(c, 401, "Invalid username or password.");
  }
  if (user.disabled) return apiError(c, 401, "This account is disabled.");
  const session = sessions.create(user.username);
  setSessionCookie(c, session.token);
  return c.json({
    ok: true,
    username: user.username,
    token: session.token,
  });
});

authRoutes.get("/me", (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;
  return c.json({ ok: true, ...publicUser(user) });
});

authRoutes.post("/password", authPasswordLimit, async (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;

  const users = c.get("users");
  const sessions = c.get("sessions");
  const body = await readPasswordChangeBody(c);
  if (!body.currentPassword || !body.newPassword || !body.confirmPassword) {
    return apiError(
      c,
      400,
      "Current password, new password, and confirmation are required.",
    );
  }
  if (!(await verifyPassword(body.currentPassword, user.passwordHash, user.passwordSalt))) {
    return apiError(c, 401, "Current password is incorrect.");
  }
  if (body.newPassword.length < 6) {
    return apiError(c, 400, "Password must be at least 6 characters.");
  }
  if (body.newPassword !== body.confirmPassword) {
    return apiError(c, 400, "New password and confirmation do not match.");
  }

  const { hash, salt } = await hashPassword(body.newPassword);
  await users.updatePassword(user.username, hash, salt);
  sessions.destroyAllForUser(user.username, requestSessionToken(c));

  return c.json({ ok: true });
});

authRoutes.post("/username", async (c) => {
  const user = requireEditor(c);
  if (isResponse(user)) return user;

  const raw = await readJsonBody(c);
  const requested = raw.username !== undefined ? String(raw.username) : "";
  const problem = usernameError(requested);
  if (problem) return apiError(c, 400, problem);

  const next = normalizedUsername(requested);
  const users = c.get("users");
  const sessions = c.get("sessions");
  if (next !== user.username) {
    const clash = users.findUser(next);
    if (clash && clash.username !== user.username) {
      return apiError(c, 409, "That username is already in use.");
    }
    try {
      await users.renameUser(user.username, next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not change the username.";
      if (message === "Username already taken") {
        return apiError(c, 409, "That username is already in use.");
      }
      return apiError(c, 400, message);
    }
    sessions.renameUser(user.username, next);
  }
  return c.json({ ok: true, username: next });
});

authRoutes.post("/logout", (c) => {
  const sessions = c.get("sessions");
  sessions.destroy(requestSessionToken(c));
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    secure: cookieSecure(),
  });
}

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production" || process.env.TESSERA_SECURE_COOKIES === "1";
}

async function authAttemptKeys(c: Context): Promise<string[]> {
  const ip = clientIp(c);
  const username = await peekAuthUsername(c);
  const keys = [`ip:${ip}`];
  if (username) keys.push(`user:${username.toLowerCase()}`);
  return keys;
}

async function peekAuthUsername(c: Context): Promise<string | undefined> {
  try {
    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.includes("application/json")) return undefined;
    const json = (await c.req.raw.clone().json()) as { username?: unknown };
    return typeof json?.username === "string" && json.username.trim()
      ? json.username.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

async function readJsonBody(c: Context): Promise<Record<string, unknown>> {
  try {
    return (await c.req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function readAuthRequest(c: Context): Promise<{
  username?: string;
  password?: string;
}> {
  const raw = await readJsonBody(c);
  return {
    username: raw.username !== undefined ? String(raw.username) : undefined,
    password: raw.password !== undefined ? String(raw.password) : undefined,
  };
}

async function readPasswordChangeBody(c: Context): Promise<{
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}> {
  const raw = await readJsonBody(c);
  return {
    currentPassword: raw.currentPassword !== undefined ? String(raw.currentPassword) : undefined,
    newPassword: raw.newPassword !== undefined ? String(raw.newPassword) : undefined,
    confirmPassword: raw.confirmPassword !== undefined ? String(raw.confirmPassword) : undefined,
  };
}
