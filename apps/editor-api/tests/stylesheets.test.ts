import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import { UserStore } from "../src/store/users.js";

describe("stylesheets", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function fixture(shell = `<link rel="stylesheet" href="./skin/w3.css" />
<link rel="stylesheet" href="./skin/w3-theme-teal.css" />
<link rel="stylesheet" href="./skin/tessera.css" />
<link rel="stylesheet" href="./site.css" />`) {
    const root = await mkdtemp(join(tmpdir(), "tessera-sheets-"));
    dirs.push(root);
    const siteRoot = join(root, "site");
    const skinDir = join(root, "skin");
    const bundleDir = join(root, "bundle");
    await mkdir(join(siteRoot, "shell"), { recursive: true });
    await mkdir(skinDir, { recursive: true });
    await mkdir(bundleDir, { recursive: true });
    await writeFile(join(siteRoot, "shell", "index.html"), shell);
    await writeFile(join(siteRoot, "shell", "site.css"), "body{color:site}\n");
    await writeFile(join(skinDir, "w3.css"), "body{color:w3}\n");
    await writeFile(join(skinDir, "tessera.css"), ":root{--tessera-bar:#009688}\n");
    await writeFile(join(skinDir, "microapps.css"), "tessera-gallery{display:block}\n");
    await writeFile(join(skinDir, "w3-theme-teal.css"), ".w3-theme{color:#fff}\n");
    const users = new UserStore(join(root, "users"));
    await users.load();
    const password = await hashPassword("secret1");
    await users.createUser("alice", password.hash, password.salt);
    const sessions = new SessionStore();
    const token = sessions.create("alice").token;
    const app = createApp({
      users,
      sessions,
      siteRoot,
      preview: { siteRoot, bundleDir, skinDir },
    });
    return { app, token, siteRoot, skinDir };
  }

  it("lists the four roles and the linked theme", async () => {
    const { app, token } = await fixture();
    const res = await app.request("/api/stylesheets", { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sheets: { id: string; overridden: boolean; text: string }[] };
    expect(body.sheets.map((sheet) => sheet.id)).toEqual(["w3", "theme", "tessera", "microapps", "site"]);
    expect(body.sheets.every((sheet) => sheet.overridden === false)).toBe(true);
    expect(body.sheets.find((sheet) => sheet.id === "site")?.text).toContain("color:site");
  });

  it("stores a site copy and drops it when the text matches the shared file", async () => {
    const { app, token, siteRoot } = await fixture();
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const saved = await app.request("/api/stylesheets/w3", {
      method: "PUT",
      headers,
      body: JSON.stringify({ text: "body{color:mine}\n" }),
    });
    expect(saved.status).toBe(200);
    const copy = await readFile(join(siteRoot, "shell", "css", "w3.css"), "utf8");
    expect(copy).toContain("color:mine");
    const listed = (await saved.json()) as { sheets: { id: string; overridden: boolean }[] };
    expect(listed.sheets.find((sheet) => sheet.id === "w3")?.overridden).toBe(true);

    const reverted = await app.request("/api/stylesheets/w3", {
      method: "PUT",
      headers,
      body: JSON.stringify({ text: "body{color:w3}\n" }),
    });
    expect(reverted.status).toBe(200);
    await expect(readFile(join(siteRoot, "shell", "css", "w3.css"), "utf8")).rejects.toThrow();
  });

  it("writes site layout in place and rejects an oversized sheet", async () => {
    const { app, token, siteRoot } = await fixture();
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const saved = await app.request("/api/stylesheets/site", {
      method: "PUT",
      headers,
      body: JSON.stringify({ text: "body{margin:0}\n" }),
    });
    expect(saved.status).toBe(200);
    expect(await readFile(join(siteRoot, "shell", "site.css"), "utf8")).toContain("margin:0");

    const huge = await app.request("/api/stylesheets/site", {
      method: "PUT",
      headers,
      body: JSON.stringify({ text: "a".repeat(256 * 1024 + 1) }),
    });
    expect(huge.status).toBe(400);
  });

  it("rejects a theme save when the shell does not link one", async () => {
    const { app, token } = await fixture(`<link rel="stylesheet" href="./skin/w3.css" />`);
    const res = await app.request("/api/stylesheets/theme", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: "body{}\n" }),
    });
    expect(res.status).toBe(404);
  });
});
