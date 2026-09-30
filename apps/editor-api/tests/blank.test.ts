import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import { SiteStore } from "../src/site/store.js";
import { UserStore } from "../src/store/users.js";

describe("blank site", () => {
  let root: string;
  let usersDir: string;
  let users: UserStore;
  let sessions: SessionStore;
  let site: SiteStore;
  let token: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "tessera-blank-"));
    usersDir = join(root, "users");
    users = new UserStore(usersDir);
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

  it("writes a shell, a master, and a home page", async () => {
    const res = await app().request("/api/site/init", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pages: number };
    expect(body.pages).toBe(1);
    const siteYaml = await readFile(join(root, "records", "site.yaml"), "utf8");
    expect(siteYaml).toContain("masterLayoutId: master");
    const shell = await readFile(join(root, "shell", "index.html"), "utf8");
    expect(shell).toContain('id="app"');
    expect(shell).toContain("./skin/chrome.css");
    expect(shell).toContain('class="rightnav fontA"');
    expect(shell).not.toContain("<header");
    const snapshot = await readFile(join(root, "publish", "data", "site.json"), "utf8");
    expect(snapshot).toContain('"type": "page"');
    expect(snapshot).toContain("This site started empty");
    expect(snapshot).toContain("mySidebar");
    expect(snapshot).toContain("breadcrumbs");
  });

  it("refuses to replace records that already exist", async () => {
    const first = await app().request("/api/site/init", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(first.status).toBe(200);
    const second = await app().request("/api/site/init", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(second.status).toBe(409);
  });
});
