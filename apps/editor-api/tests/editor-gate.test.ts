import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import { UserStore } from "../src/store/users.js";

describe("requireEditor gate", () => {
  let dataDir: string;
  let users: UserStore;
  let sessions: SessionStore;
  let token: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-gate-"));
    users = new UserStore(dataDir);
    await users.load();
    const password = await hashPassword("secret1");
    await users.createUser("alice", password.hash, password.salt);
    sessions = new SessionStore();
    token = sessions.create("alice").token;
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  function app() {
    return createApp({ users, sessions });
  }

  it("rejects anonymous POST /api/ping", async () => {
    const res = await app().request("/api/ping", { method: "POST" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it.each([
    ["POST", "/api/ping"],
    ["POST", "/api/render"],
    ["POST", "/api/publish"],
    ["POST", "/api/site/init"],
    ["POST", "/api/site/reseed"],
    ["PUT", "/api/records/content/home"],
    ["POST", "/api/library/folders"],
    ["PATCH", "/api/library/folders/photos"],
    ["DELETE", "/api/library/folders/photos"],
    ["POST", "/api/library/upload"],
    ["PATCH", "/api/library/assets/photo"],
    ["DELETE", "/api/library/assets/photo"],
    ["PUT", "/api/stylesheets/site"],
    ["POST", "/api/backups"],
    ["POST", "/api/backups/example.tar.gz/delete"],
    ["POST", "/api/backups/example.tar.gz/restore"],
    ["POST", "/api/examples/willow/restore"],
    ["POST", "/api/users"],
    ["PATCH", "/api/users/bob"],
    ["DELETE", "/api/users/bob"],
    ["POST", "/auth/password"],
    ["POST", "/auth/username"],
  ])("rejects anonymous mutation %s %s", async (method, path) => {
    const res = await app().request(path, { method });
    expect(res.status).toBe(401);
  });

  it("allows an authenticated editor POST /api/ping", async () => {
    const res = await app().request("/api/ping", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, username: "alice" });
  });

  it.each(["/api/records", "/api/library", "/api/render"])(
    "returns 404 for authenticated site route %s when no site is configured",
    async (path) => {
      const res = await app().request(path, {
        method: path === "/api/render" ? "POST" : "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "No site data directory configured." });
    },
  );
});
