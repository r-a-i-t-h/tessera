import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import { SiteStore } from "../src/site/store.js";
import { UserStore } from "../src/store/users.js";

describe("limited editor access", () => {
  let dataDir: string;
  let siteDir: string;
  let users: UserStore;
  let sessions: SessionStore;
  let site: SiteStore;
  let adminToken: string;
  let editorToken: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-access-data-"));
    siteDir = await mkdtemp(join(tmpdir(), "tessera-access-site-"));
    users = new UserStore(dataDir);
    await users.load();
    const password = await hashPassword("secret1");
    await users.createUser("admin", password.hash, password.salt);
    const editorPass = await hashPassword("secret2");
    await users.createUser("editor", editorPass.hash, editorPass.salt, { restrictAccessLevel: "editor" });
    sessions = new SessionStore();
    adminToken = sessions.create("admin").token;
    editorToken = sessions.create("editor").token;
    site = new SiteStore(siteDir, join(siteDir, "out.json"));
    await site.write("content", "home", {
      title: "Home",
      tags: ["page"],
      zones: { main: { html: "<p>Hello</p>" } },
    });
    await site.writeSite({
      version: 2,
      id: "demo",
      title: "Demo",
      homePageId: "home",
      defaultLayoutId: "standard",
    });
    await site.writeNav([{ id: "home", title: "Home", topbar: true }]);
    await site.write("layouts", "standard", {
      root: { type: "zone", id: "main" },
    });
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
    await rm(siteDir, { recursive: true, force: true });
  });

  function app() {
    return createApp({ users, sessions, site, siteRoot: siteDir });
  }

  function auth(token: string): HeadersInit {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  it("exposes restrictAccessLevel on /auth/me", async () => {
    const admin = await app().request("/auth/me", { headers: auth(adminToken) });
    const adminBody = (await admin.json()) as { username: string; restrictAccessLevel?: string };
    expect(adminBody).toMatchObject({ username: "admin" });
    expect(adminBody.restrictAccessLevel).toBeUndefined();

    const res = await app().request("/auth/me", { headers: auth(editorToken) });
    expect(await res.json()).toMatchObject({ username: "editor", restrictAccessLevel: "editor" });
  });

  it("blocks limited editors from admin routes", async () => {
    expect((await app().request("/api/users", { headers: auth(editorToken) })).status).toBe(403);
    expect(
      (await app().request("/api/stylesheets", { headers: auth(editorToken) })).status,
    ).toBe(403);
    expect((await app().request("/api/backups", { headers: auth(editorToken) })).status).toBe(403);
    expect((await app().request("/api/runtime-modules", { headers: auth(editorToken) })).status).toBe(403);
    expect(
      (
        await app().request("/api/datasets", {
          method: "POST",
          headers: auth(editorToken),
          body: JSON.stringify({ id: "newds", title: "New" }),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await app().request("/api/site/init", {
          method: "POST",
          headers: auth(editorToken),
        })
      ).status,
    ).toBe(403);
  });

  it("allows content and nav but not layouts for limited editors", async () => {
    expect(
      (await app().request("/api/records/content/home", { headers: auth(editorToken) })).status,
    ).toBe(200);
    expect((await app().request("/api/records/nav/nav", { headers: auth(editorToken) })).status).toBe(200);
    expect(
      (
        await app().request("/api/records/layouts/standard", {
          headers: auth(editorToken),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await app().request("/api/records/site/site", {
          method: "PUT",
          headers: auth(editorToken),
          body: JSON.stringify({
            data: { version: 2, id: "demo", title: "X", homePageId: "home", defaultLayoutId: "standard" },
          }),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await app().request("/api/records/nav/nav", {
          method: "PUT",
          headers: auth(editorToken),
          body: JSON.stringify({ data: [{ id: "home", title: "Home", topbar: true }] }),
        })
      ).status,
    ).toBe(200);
  });

  it("filters record listing for limited editors", async () => {
    const res = await app().request("/api/records", { headers: auth(editorToken) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { records: { kind: string }[] };
    const kinds = new Set(body.records.map((row) => row.kind));
    expect(kinds.has("content")).toBe(true);
    expect(kinds.has("nav")).toBe(true);
    expect(kinds.has("layouts")).toBe(false);
  });

  it("still allows ping and dataset list for limited editors", async () => {
    expect(
      (await app().request("/api/ping", { method: "POST", headers: auth(editorToken) })).status,
    ).toBe(200);
    expect((await app().request("/api/datasets", { headers: auth(editorToken) })).status).toBe(200);
  });
});
