import { Hono } from "hono";
import type { Context } from "hono";
import { normalizedUsername, usernameError } from "../auth/username.js";
import { hashPassword } from "../auth/password.js";
import { apiError, managedUser } from "../http.js";
import { authenticatedEditor } from "../middleware/editor-site.js";
import type { UserRecord } from "../model.js";
import { requestSessionToken } from "../middleware/auth.js";
import type { SessionStore } from "../auth/sessions.js";

export const userRoutes = new Hono();
userRoutes.use("/users", authenticatedEditor);
userRoutes.use("/users/*", authenticatedEditor);

userRoutes.get("/users", (c) => {
  return c.json({
    ok: true,
    users: c.get("users").listUsers().map(managedUser),
  });
});

userRoutes.post("/users", async (c) => {
  const body = await readUserBody(c);
  const problem = usernameError(body.username ?? "");
  if (problem) return apiError(c, 400, problem);
  const passwordError = passwordProblem(body.password, true);
  if (passwordError) return apiError(c, 400, passwordError);

  const users = c.get("users");
  const name = normalizedUsername(body.username ?? "");
  if (users.findUser(name)) return apiError(c, 409, "That username is already in use.");
  try {
    const { hash, salt } = await hashPassword(body.password ?? "");
    const created = await users.createUser(name, hash, salt);
    return c.json({ ok: true, user: managedUser(created) });
  } catch (err) {
    return storeFailure(c, err);
  }
});

userRoutes.patch("/users/:username", async (c) => {
  const actor = c.get("editor");
  const users = c.get("users");
  const sessions = c.get("sessions");
  const current = users.getUser(c.req.param("username"));
  if (!current) return apiError(c, 404, "User not found");

  const body = await readUserBody(c);
  const renaming = body.username !== undefined;
  const nextName = renaming ? normalizedUsername(body.username ?? "") : current.username;
  if (renaming) {
    const problem = usernameError(body.username ?? "");
    if (problem) return apiError(c, 400, problem);
    const clash = users.findUser(nextName);
    if (clash && clash.username !== current.username) {
      return apiError(c, 409, "That username is already in use.");
    }
  }

  const passwordError = passwordProblem(body.password, false);
  if (passwordError) return apiError(c, 400, passwordError);

  const self = current.username === actor.username;
  if (body.disabled === true && self) {
    return apiError(c, 400, "You cannot disable the account you are signed in with.");
  }

  try {
    let record = current;
    if (body.password) {
      const { hash, salt } = await hashPassword(body.password);
      record = await users.updatePassword(record.username, hash, salt);
    }
    if (body.disabled !== undefined) {
      record = await users.setDisabled(record.username, body.disabled);
    }
    if (nextName !== record.username) {
      const from = record.username;
      record = await users.renameUser(from, nextName);
      sessions.renameUser(from, record.username);
    }
    endSessions(sessions, record, self, body.password !== undefined && body.password !== "", c);
    return c.json({ ok: true, user: managedUser(record) });
  } catch (err) {
    return storeFailure(c, err);
  }
});

userRoutes.delete("/users/:username", async (c) => {
  const actor = c.get("editor");
  const users = c.get("users");
  const username = c.req.param("username");
  const current = users.getUser(username);
  if (!current) return apiError(c, 404, "User not found");
  if (current.username === actor.username) {
    return apiError(c, 400, "You cannot delete the account you are signed in with.");
  }
  try {
    await users.deleteUser(current.username);
  } catch (err) {
    return storeFailure(c, err);
  }
  c.get("sessions").destroyAllForUser(current.username);
  return c.json({ ok: true });
});

function endSessions(
  sessions: SessionStore,
  record: UserRecord,
  self: boolean,
  passwordChanged: boolean,
  c: Context,
): void {
  if (record.disabled === true) {
    sessions.destroyAllForUser(record.username);
    return;
  }
  if (!passwordChanged) return;
  sessions.destroyAllForUser(record.username, self ? requestSessionToken(c) : undefined);
}

function passwordProblem(password: string | undefined, required: boolean): string | undefined {
  if (!password) return required ? "Password must be at least 6 characters." : undefined;
  if (password.length < 6) return "Password must be at least 6 characters.";
  return undefined;
}

function storeFailure(c: Context, err: unknown): Response {
  const message = err instanceof Error ? err.message : "Could not update that user.";
  if (message === "User not found") return apiError(c, 404, message);
  if (message === "Username already taken") return apiError(c, 409, "That username is already in use.");
  return apiError(c, 400, message);
}

async function readUserBody(c: Context): Promise<{
  username?: string;
  password?: string;
  disabled?: boolean;
}> {
  let raw: Record<string, unknown>;
  try {
    raw = (await c.req.json()) as Record<string, unknown>;
  } catch {
    raw = {};
  }
  return {
    username: raw.username !== undefined ? String(raw.username) : undefined,
    password: raw.password !== undefined ? String(raw.password) : undefined,
    disabled: typeof raw.disabled === "boolean" ? raw.disabled : undefined,
  };
}
