import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import { UserStore } from "../src/store/users.js";

const SHELL = `<!DOCTYPE html>
<html lang="en-GB">
  <head>
    <meta name="tessera-site" content="./data/site.abc123.json" />
  </head>
  <body>
    <script type="module" src="./tessera.js"></script>
  </body>
</html>
`;

describe("editor preview host", () => {
  let siteRoot: string;
  let bundleDir: string;
  let skinDir: string;
  let spaDir: string;
  let users: UserStore;
  let sessions: SessionStore;

  beforeEach(async () => {
    const root = await mkdtemp(join(tmpdir(), "tessera-preview-"));
    siteRoot = join(root, "site");
    bundleDir = join(root, "bundle");
    skinDir = join(root, "skin");
    spaDir = join(root, "spa");
    const userDir = join(root, "users");
    await mkdir(join(siteRoot, "shell"), { recursive: true });
    await mkdir(join(siteRoot, "preview", "data"), { recursive: true });
    await mkdir(join(siteRoot, "publish", "data"), { recursive: true });
    await mkdir(join(siteRoot, "publish", "media"), { recursive: true });
    await mkdir(join(siteRoot, "publish", "img"), { recursive: true });
    await mkdir(join(siteRoot, "files"), { recursive: true });
    await mkdir(join(siteRoot, "records"), { recursive: true });
    await mkdir(bundleDir, { recursive: true });
    await mkdir(skinDir, { recursive: true });
    await mkdir(spaDir, { recursive: true });
    await writeFile(join(siteRoot, "shell", "index.html"), SHELL);
    await writeFile(join(siteRoot, "shell", "site.css"), "body{color:shell}\n");
    await writeFile(join(siteRoot, "preview", "data", "site.abc123.json"), '{"from":"preview"}\n');
    await writeFile(join(siteRoot, "publish", "data", "site.abc123.json"), '{"from":"publish"}\n');
    await writeFile(join(siteRoot, "publish", "data", "only-publish.json"), '{"from":"publish-only"}\n');
    await writeFile(join(siteRoot, "files", "photo.png"), "from-files\n");
    await writeFile(join(siteRoot, "publish", "media", "photo.png"), "from-publish\n");
    await writeFile(join(siteRoot, "publish", "img", "logo.svg"), "<svg id=\"published\"/>\n");
    await writeFile(join(siteRoot, "publish", "site.css"), "body{color:publish}\n");
    await writeFile(join(siteRoot, "records", "secret.txt"), "secret-record\n");
    await writeFile(join(bundleDir, "tessera.js"), "export const runtime = \"built\";\n");
    await writeFile(join(skinDir, "w3.css"), "body{color:teal}\n");
    await writeFile(join(spaDir, "index.html"), "<!doctype html><title>Editor</title>");

    users = new UserStore(userDir);
    await users.load();
    const password = await hashPassword("secret1");
    await users.createUser("alice", password.hash, password.salt);
    sessions = new SessionStore();
  });

  afterEach(async () => {
    await rm(join(siteRoot, ".."), { recursive: true, force: true });
  });

  function app() {
    return createApp({
      users,
      sessions,
      spaDir,
      preview: { siteRoot, bundleDir, skinDir },
    });
  }

  async function cookie(): Promise<string> {
    const res = await app().request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "secret1" }),
    });
    const match = (res.headers.get("set-cookie") ?? "").match(/tessera_session=([^;]+)/);
    return `tessera_session=${match![1]}`;
  }

  it("asks a signed-out visitor to open the editor, and rejects assets", async () => {
    const page = await app().request("/preview/");
    expect(page.status).toBe(401);
    expect(await page.text()).toContain('href="/"');

    const asset = await app().request("/preview/tessera.js");
    expect(asset.status).toBe(401);
    expect(await asset.json()).toEqual({ error: "Authentication required" });
  });

  it("serves the shell unchanged so relative URLs resolve under /preview/", async () => {
    const headers = { Cookie: await cookie() };
    const a = app();

    const slashless = await a.request("/preview", { headers });
    expect(slashless.status).toBe(302);
    expect(slashless.headers.get("location")).toMatch(/\/preview\/$/);

    const page = await a.request("/preview/", { headers });
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toMatch(/html/);
    expect(page.headers.get("cache-control")).toBe("no-cache");
    const html = await page.text();
    expect(html).toBe(SHELL);
    expect(html).toContain('src="./tessera.js"');
    expect(html).toContain('content="./data/site.abc123.json"');

    const index = await a.request("/preview/index.html", { headers });
    expect(await index.text()).toBe(SHELL);

    const runtime = await a.request("/preview/tessera.js", { headers });
    expect(runtime.status).toBe(200);
    expect(runtime.headers.get("content-type")).toMatch(/javascript/);
    expect(await runtime.text()).toContain('runtime = "built"');

    const data = await a.request("/preview/data/site.abc123.json", { headers });
    expect(data.status).toBe(200);
    const body = await data.text();
    expect(body).toContain('"from":"preview"');
    expect(body).not.toContain("publish");
  });

  it("reads skin, library files, and shell assets, and never publish data", async () => {
    const headers = { Cookie: await cookie() };
    const a = app();

    expect(await (await a.request("/preview/skin/w3.css", { headers })).text()).toContain("teal");
    expect(await (await a.request("/preview/media/photo.png", { headers })).text()).toContain("from-files");
    expect(await (await a.request("/preview/site.css", { headers })).text()).toContain("color:shell");
    expect(await (await a.request("/preview/img/logo.svg", { headers })).text()).toContain("published");

    const publishedOnly = await a.request("/preview/data/only-publish.json", { headers });
    expect(publishedOnly.status).toBe(404);
  });

  it("rejects a path that tries to leave the preview folder", async () => {
    const headers = { Cookie: await cookie() };
    const escaped = await app().request("/preview/data/..%2f..%2frecords/secret.txt", { headers });
    expect(escaped.status).toBe(404);
    expect(await escaped.text()).not.toContain("secret-record");
  });

  it("does not hand /preview/ to the editor SPA", async () => {
    const headers = { Cookie: await cookie() };
    const editor = await app().request("/");
    expect(await editor.text()).toContain("<title>Editor</title>");
    const preview = await app().request("/preview/", { headers });
    expect(await preview.text()).toBe(SHELL);
  });

  it("says how to build the runtime when tessera.js is missing", async () => {
    await rm(join(bundleDir, "tessera.js"));
    const headers = { Cookie: await cookie() };
    const page = await app().request("/preview/", { headers });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("npm run build -w @r-a-i-t-h/tessera-site");
    expect(html).not.toContain("./tessera.js");
  });

  it("uses the empty-site placeholder when the shell is missing", async () => {
    await rm(join(siteRoot, "shell", "index.html"));
    const headers = { Cookie: await cookie() };
    const page = await app().request("/preview/", { headers });
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("This site folder is empty");
  });
});
