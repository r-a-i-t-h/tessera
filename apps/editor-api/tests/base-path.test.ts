import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import { UserStore } from "../src/store/users.js";

describe("subdirectory base path", () => {
  let dataDir: string;
  let users: UserStore;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-base-"));
    users = new UserStore(dataDir);
    await users.load();
    const password = await hashPassword("secret1");
    await users.createUser("alice", password.hash, password.salt);
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  function app(base: string) {
    return createApp({
      users,
      sessions: new SessionStore(),
      assetBase: base,
    });
  }

  it("serves routes under the configured base path and 404s at the domain root", async () => {
    const a = app("garden");
    expect((await a.request("/health")).status).toBe(404);

    const nested = await a.request("/garden/health");
    expect(nested.status).toBe(200);
    expect(await nested.json()).toEqual({ ok: true, name: "tessera-editor-api" });
  });

  it("scopes session cookies to the base path and unique cookie name", async () => {
    const a = app("garden");
    const res = await a.request("/garden/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "secret1" }),
    });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie.toLowerCase()).toContain("path=/garden");
    expect(setCookie).toMatch(/tessera_garden_session=/);
  });

  it("keeps root deploy working when base path is empty", async () => {
    const a = app("");
    const res = await a.request("/health");
    expect(res.status).toBe(200);
    const login = await a.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "secret1" }),
    });
    const setCookie = login.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/tessera_session=/);
    expect(setCookie).not.toMatch(/tessera_.+_session=/);
  });
});
