import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    expect(body.pages).toBe(4);
    const siteYaml = await readFile(join(root, "records", "site.yaml"), "utf8");
    expect(siteYaml).toContain("masterLayoutId: master");
    const shell = await readFile(join(root, "shell", "index.html"), "utf8");
    expect(shell).toContain('id="app"');
    expect(shell).toContain("./skin/tessera.css");
    expect(shell).toContain("./skin/microapps.css");
    expect(shell).toContain("./skin/w3-theme-teal.css");
    expect(shell).not.toContain("chrome.css");
    expect(shell).toContain('class="leftnav fontA"');
    const siteCss = await readFile(join(root, "shell", "site.css"), "utf8");
    expect(siteCss).toContain("max-width: 992px");
    expect(siteCss).toContain("right: 0");
    expect(shell).not.toContain("<header");
    const snapshot = await readFile(join(root, "publish", "data", "site.json"), "utf8");
    expect(snapshot).toContain('"type": "page"');
    expect(snapshot).toContain("Hello world");
    expect(snapshot).toContain("common-footer");
    expect(snapshot).toContain('"id": "blogger"');
    expect(snapshot).toContain("The blog begins");
    expect(snapshot).toContain("2026-10-09");
    expect(snapshot).toContain("tessera-blog");
    expect(snapshot).toContain('"navSide": "left"');
    expect(snapshot).toContain("mySidebar");
    expect(snapshot).toContain("w3-collapse");
    expect(snapshot).toContain("tessera-menu-btn w3-hide-large");
    expect(snapshot).toContain("w3-right tessera-menu-btn");
    expect(snapshot).toContain("breadcrumbs");
    const master = await readFile(join(root, "records", "layouts", "master.yaml"), "utf8");
    expect(master).toContain("includes:");
    expect(master).toContain("- common-footer");
    const home = await readFile(join(root, "records", "content", "home.yaml"), "utf8");
    expect(home).toContain("type: standard");
    expect(home).not.toContain("common-footer");
    const type = await readFile(join(root, "records", "types", "standard.yaml"), "utf8");
    expect(type).toContain("layoutId: standard");
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

  it("re-seeds over an existing site and keeps editors", async () => {
    const backup = join(root, "backup");
    const started = await app().request("/api/site/init", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(started.status).toBe(200);
    await mkdir(join(root, "records", "content"), { recursive: true });
    await writeFile(join(root, "records", "content", "extra.yaml"), "id: extra\ntitle: Extra\n");
    await mkdir(join(root, "publish"), { recursive: true });
    await writeFile(join(root, "publish", "keep.txt"), "old\n");
    await mkdir(join(root, "files"), { recursive: true });
    await writeFile(join(root, "files", "pic.bin"), "x");
    await writeFile(join(root, "meta.json"), '{"schemaVersion":1}\n');

    const res = await createApp({
      users,
      sessions,
      site,
      siteRoot: root,
      backupDir: backup,
    }).request("/api/site/reseed", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pages: number; safetyBackup: string };
    expect(body.pages).toBe(4);
    expect(body.safetyBackup).toMatch(/\.tar\.gz$/);
    await expect(readFile(join(root, "records", "content", "extra.yaml"), "utf8")).rejects.toThrow();
    await expect(readFile(join(root, "publish", "keep.txt"), "utf8")).rejects.toThrow();
    await expect(readFile(join(root, "files", "pic.bin"))).rejects.toThrow();
    expect(await readFile(join(root, "meta.json"), "utf8")).toContain("schemaVersion");
    const home = await readFile(join(root, "records", "content", "home.yaml"), "utf8");
    expect(home).toContain("Hello world");
    const usersFile = await readFile(join(usersDir, "users", "alice.json"), "utf8");
    expect(usersFile).toContain("alice");
  });
});
