import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import { UserStore } from "../src/store/users.js";

describe("auth routes", () => {
  let dataDir: string;
  let users: UserStore;
  let sessions: SessionStore;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-auth-"));
    users = new UserStore(dataDir);
    await users.load();
    const password = await hashPassword("secret1");
    await users.createUser("alice", password.hash, password.salt);
    sessions = new SessionStore();
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  function app() {
    return createApp({ users, sessions });
  }

  async function login(password = "secret1") {
    return app().request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password }),
    });
  }

  it("returns health without auth", async () => {
    const res = await app().request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, name: "tessera-editor-api" });
  });

  it("logs in with JSON and sets an httpOnly cookie", async () => {
    const res = await login();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; username: string; token: string };
    expect(body.ok).toBe(true);
    expect(body.username).toBe("alice");
    expect(body.token).toMatch(/^[0-9a-f]{64}$/);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/tessera_session=/);
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("path=/");
  });

  it.fails("logs in case-insensitively while preserving the stored username", async () => {
    await users.renameUser("alice", "Alice");

    const res = await login();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, username: "Alice" });
  });

  it("rejects a bad password", async () => {
    const res = await login("nope");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid username or password." });
  });

  it("has no register route", async () => {
    const res = await app().request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "bob", password: "secret1" }),
    });
    expect(res.status).toBe(404);
  });

  it("requires auth for /auth/me then returns the public user", async () => {
    const anon = await app().request("/auth/me");
    expect(anon.status).toBe(401);

    const token = sessions.create("alice").token;
    const res = await app().request("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      ok: true,
      username: "alice",
      createdAt: expect.any(String),
    });
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(JSON.stringify(body)).not.toContain("passwordSalt");
  });

  it("accepts the session cookie for /auth/me", async () => {
    const loginRes = await login();
    const setCookie = loginRes.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/tessera_session=([^;]+)/);
    expect(match?.[1]).toBeTruthy();

    const res = await app().request("/auth/me", {
      headers: { Cookie: `tessera_session=${match![1]}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, username: "alice" });
  });

  it("changes the password, keeps the current session, and drops others", async () => {
    const token = sessions.create("alice").token;
    const other = sessions.create("alice").token;
    const res = await app().request("/auth/password", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: "secret1",
        newPassword: "secret2",
        confirmPassword: "secret2",
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const stillIn = await app().request("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(stillIn.status).toBe(200);

    const kicked = await app().request("/auth/me", {
      headers: { Authorization: `Bearer ${other}` },
    });
    expect(kicked.status).toBe(401);

    expect((await login("secret1")).status).toBe(401);
    expect((await login("secret2")).status).toBe(200);
  });

  it("rejects a wrong current password and a confirmation mismatch", async () => {
    const token = sessions.create("alice").token;
    const wrong = await app().request("/auth/password", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: "nope",
        newPassword: "secret2",
        confirmPassword: "secret2",
      }),
    });
    expect(wrong.status).toBe(401);

    const mismatch = await app().request("/auth/password", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword: "secret1",
        newPassword: "secret2",
        confirmPassword: "secret3",
      }),
    });
    expect(mismatch.status).toBe(400);
  });

  it("rejects a disabled account only after the password matches", async () => {
    await users.setDisabled("alice", true);
    const wrong = await login("nope");
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: "Invalid username or password." });

    const res = await login();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "This account is disabled." });
  });

  it("ignores an existing session once the account is disabled", async () => {
    const token = sessions.create("alice").token;
    await users.setDisabled("alice", true);
    const res = await app().request("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });

  it("changes the signed-in username and keeps this session", async () => {
    const token = sessions.create("alice").token;
    const password = await hashPassword("secret1");
    await users.createUser("bob", password.hash, password.salt);

    const clash = await app().request("/auth/username", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "BOB" }),
    });
    expect(clash.status).toBe(409);
    expect(await clash.json()).toEqual({ error: "That username is already in use." });

    const blank = await app().request("/auth/username", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "   " }),
    });
    expect(blank.status).toBe(400);
    expect(await blank.json()).toEqual({
      error: "Username must include at least one visible character.",
    });

    const digit = await app().request("/auth/username", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "1alice" }),
    });
    expect(digit.status).toBe(400);

    const res = await app().request("/auth/username", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "  alice2 " }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, username: "alice2" });

    const me = await app().request("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ ok: true, username: "alice2" });
    expect(users.getUser("alice")).toBeUndefined();
    expect(users.getUser("alice2")?.username).toBe("alice2");
  });

  it("logout is idempotent and clears the cookie", async () => {
    const token = sessions.create("alice").token;
    const res = await app().request("/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sessions.get(token)).toBeUndefined();

    const again = await app().request("/auth/logout", { method: "POST" });
    expect(again.status).toBe(200);
  });
});
