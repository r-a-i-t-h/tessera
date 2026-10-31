import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { contentZones } from "./fixtures/content-zones.js";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import { SiteStore } from "../src/site/store.js";
import { UserStore } from "../src/store/users.js";

describe("GET /api/editor-index", () => {
  let dataDir: string;
  let siteDir: string;
  let users: UserStore;
  let sessions: SessionStore;
  let site: SiteStore;
  let token: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-index-data-"));
    siteDir = await mkdtemp(join(tmpdir(), "tessera-index-site-"));
    users = new UserStore(dataDir);
    await users.load();
    const password = await hashPassword("secret1");
    await users.createUser("admin", password.hash, password.salt);
    sessions = new SessionStore();
    token = sessions.create("admin").token;
    site = new SiteStore(siteDir, join(siteDir, "out.json"));
    await site.write("content", "home", {
      title: "Home",
      zones: contentZones("<p>Hi</p>"),
    });
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
    await rm(siteDir, { recursive: true, force: true });
  });

  function auth(): HeadersInit {
    return { Authorization: `Bearer ${token}` };
  }

  it("returns palette items and version", async () => {
    const app = createApp({ users, sessions, site, siteRoot: siteDir });
    const res = await app.request("/api/editor-index", { headers: auth() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: string; items: { label: string; hash?: string }[] };
    expect(body.version).toMatch(/^\d+:\d+$/);
    expect(body.items.some((i) => i.label === "Home" && i.hash === "#/content/home")).toBe(true);
    expect(body.items.some((i) => i.action === "render")).toBe(true);
    const etag = res.headers.get("ETag");
    expect(etag).toBeTruthy();
    const again = await app.request("/api/editor-index", {
      headers: { ...auth(), "If-None-Match": etag ?? "" },
    });
    expect(again.status).toBe(304);
  });
});
