import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import { UserStore } from "../src/store/users.js";

describe("editor SPA static host", () => {
  let dataDir: string;
  let spaDir: string;
  let users: UserStore;
  let sessions: SessionStore;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-spa-data-"));
    spaDir = await mkdtemp(join(tmpdir(), "tessera-spa-"));
    users = new UserStore(dataDir);
    await users.load();
    const password = await hashPassword("secret1");
    await users.createUser("alice", password.hash, password.salt);
    sessions = new SessionStore();
    await writeFile(join(spaDir, "index.html"), "<!doctype html><title>Editor</title>");
    await mkdir(join(spaDir, "assets"));
    await writeFile(join(spaDir, "assets", "app.js"), "console.log(1);\n");
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
    await rm(spaDir, { recursive: true, force: true });
  });

  function app() {
    return createApp({ users, sessions, spaDir });
  }

  it("does not serve HTML when spaDir is omitted", async () => {
    const jsonOnly = createApp({ users, sessions });
    expect((await jsonOnly.request("/")).status).toBe(404);
  });

  it("serves the SPA and hashed assets without stealing JSON routes", async () => {
    const a = app();
    const page = await a.request("/");
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("<title>Editor</title>");

    const asset = await a.request("/assets/app.js");
    expect(asset.status).toBe(200);
    expect(await asset.text()).toContain("console.log(1)");
    expect(asset.headers.get("content-type")).toMatch(/javascript/);

    const health = await a.request("/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true, name: "tessera-editor-api" });

    const me = await a.request("/auth/me");
    expect(me.status).toBe(401);
  });

  it("404s missing hashed assets and falls back to index for other GET paths", async () => {
    const a = app();
    expect((await a.request("/assets/missing.js")).status).toBe(404);
    const fallback = await a.request("/workspace");
    expect(fallback.status).toBe(200);
    expect(await fallback.text()).toContain("<title>Editor</title>");
  });
});
