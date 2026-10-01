import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import { UserStore } from "../src/store/users.js";

describe("user admin routes", () => {
  let dataDir: string;
  let users: UserStore;
  let sessions: SessionStore;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-user-admin-"));
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

  function auth(token: string): HeadersInit {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  it("requires auth to list users", async () => {
    const res = await app().request("/api/users");
    expect(res.status).toBe(401);
  });

  it("adds, edits, disables, and deletes another user", async () => {
    const token = sessions.create("alice").token;
    const created = await app().request("/api/users", {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ username: "  bob ", password: "secret2" }),
    });
    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({
      ok: true,
      user: { username: "bob", disabled: false },
    });

    const clash = await app().request("/api/users", {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ username: "Bob", password: "secret2" }),
    });
    expect(clash.status).toBe(409);

    const bad = await app().request("/api/users", {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ username: "9bob", password: "secret2" }),
    });
    expect(bad.status).toBe(400);

    const short = await app().request("/api/users", {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ username: "cara", password: "short" }),
    });
    expect(short.status).toBe(400);

    const bobToken = sessions.create("bob").token;
    const renamed = await app().request("/api/users/bob", {
      method: "PATCH",
      headers: auth(token),
      body: JSON.stringify({ username: "bobby", password: "secret3" }),
    });
    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toMatchObject({ ok: true, user: { username: "bobby" } });
    expect(sessions.get(bobToken)).toBeUndefined();

    const bobby = sessions.create("bobby").token;
    const disabled = await app().request("/api/users/bobby", {
      method: "PATCH",
      headers: auth(token),
      body: JSON.stringify({ disabled: true }),
    });
    expect(disabled.status).toBe(200);
    expect(sessions.get(bobby)).toBeUndefined();

    const signedOut = await app().request("/api/ping", {
      method: "POST",
      headers: { Authorization: `Bearer ${bobby}` },
    });
    expect(signedOut.status).toBe(401);

    const login = await app().request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "bobby", password: "secret3" }),
    });
    expect(login.status).toBe(401);
    expect(await login.json()).toEqual({ error: "This account is disabled." });

    const enabled = await app().request("/api/users/bobby", {
      method: "PATCH",
      headers: auth(token),
      body: JSON.stringify({ disabled: false }),
    });
    expect(enabled.status).toBe(200);
    const back = await app().request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "bobby", password: "secret3" }),
    });
    expect(back.status).toBe(200);

    const removed = await app().request("/api/users/bobby", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(removed.status).toBe(200);
    expect(users.getUser("bobby")).toBeUndefined();

    const selfDelete = await app().request("/api/users/alice", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(selfDelete.status).toBe(400);
    expect(users.getUser("alice")?.username).toBe("alice");

    const selfDisable = await app().request("/api/users/alice", {
      method: "PATCH",
      headers: auth(token),
      body: JSON.stringify({ disabled: true }),
    });
    expect(selfDisable.status).toBe(400);
    const still = await app().request("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(still.status).toBe(200);
  });

  it("keeps your session when you rename yourself from the users page", async () => {
    const token = sessions.create("alice").token;
    const res = await app().request("/api/users/alice", {
      method: "PATCH",
      headers: auth(token),
      body: JSON.stringify({ username: "alicia" }),
    });
    expect(res.status).toBe(200);
    const me = await app().request("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(await me.json()).toMatchObject({ username: "alicia" });
  });
});
