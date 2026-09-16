import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import { SiteStore } from "../src/site/store.js";
import { UserStore } from "../src/store/users.js";

describe("record routes", () => {
  let dataDir: string;
  let siteDir: string;
  let users: UserStore;
  let sessions: SessionStore;
  let site: SiteStore;
  let token: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-rec-data-"));
    siteDir = await mkdtemp(join(tmpdir(), "tessera-rec-site-"));
    users = new UserStore(dataDir);
    await users.load();
    const password = await hashPassword("secret1");
    await users.createUser("alice", password.hash, password.salt);
    sessions = new SessionStore();
    token = sessions.create("alice").token;
    site = new SiteStore(siteDir, join(siteDir, "out.json"));
    await site.write("content", "home", {
      title: "Home",
      tags: ["page"],
      zones: { main: { html: "<p>Hello</p>" } },
    });
    await site.writeSite({
      version: 1,
      id: "demo",
      title: "Demo",
      homePageId: "home",
      defaultLayoutId: "standard",
    });
    await site.writeNav([{ id: "home", title: "Home", topbar: true }]);
    await site.write("layouts", "standard", {
      title: "Standard",
      root: { type: "zone", id: "main" },
    });
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
    await rm(siteDir, { recursive: true, force: true });
  });

  function app() {
    return createApp({ users, sessions, site });
  }

  it("rejects anonymous record reads", async () => {
    const res = await app().request("/api/records");
    expect(res.status).toBe(401);
  });

  it("lists and updates a content record", async () => {
    const list = await app().request("/api/records", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.status).toBe(200);
    const body = (await list.json()) as { records: { id: string; kind: string }[] };
    expect(body.records.some((r) => r.kind === "content" && r.id === "home")).toBe(true);

    const saved = await app().request("/api/records/content/home", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: { title: "Welcome", zones: { main: { html: "<p>Updated</p>" } } },
      }),
    });
    expect(saved.status).toBe(200);

    const read = await app().request("/api/records/content/home", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const record = (await read.json()) as { data: { title: string } };
    expect(record.data.title).toBe("Welcome");
  });
});
