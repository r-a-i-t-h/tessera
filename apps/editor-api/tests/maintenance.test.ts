import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import { SiteStore } from "../src/site/store.js";
import { UserStore } from "../src/store/users.js";

describe("maintenance", () => {
  let root: string;
  let users: UserStore;
  let sessions: SessionStore;
  let site: SiteStore;
  let token: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "tessera-maint-"));
    users = new UserStore(join(root, "users"));
    await users.load();
    const password = await hashPassword("secret1");
    await users.createUser("alice", password.hash, password.salt);
    sessions = new SessionStore();
    token = sessions.create("alice").token;
    site = new SiteStore(join(root, "records"), join(root, "publish", "data", "site.json"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function app() {
    return createApp({ users, sessions, site, siteRoot: root });
  }

  it("requires auth", async () => {
    const res = await app().request("/api/maintenance");
    expect(res.status).toBe(401);
  });

  it("returns all report sections for a blank site", async () => {
    const init = await app().request("/api/site/init", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(init.status).toBe(200);

    const res = await app().request("/api/maintenance", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    for (const key of [
      "orphans",
      "unusedAssets",
      "brokenRefs",
      "unusedItems",
      "unusedLayouts",
      "unknownBindings",
      "unreachableNav",
      "rescanDrift",
    ]) {
      expect(body).toHaveProperty(key);
    }
    const drift = body.rescanDrift as { danglingMedia: unknown[]; scannedAssets: unknown[] };
    expect(Array.isArray(drift.danglingMedia)).toBe(true);
    expect(Array.isArray(drift.scannedAssets)).toBe(true);
  });
});
