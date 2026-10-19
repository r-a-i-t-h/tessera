import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import { writeSeedFiles } from "../src/site/blank.js";
import { applyThemeKit } from "../src/site/theme-kit.js";
import { SiteStore } from "../src/site/store.js";
import { UserStore } from "../src/store/users.js";

const seedDir = join(dirname(fileURLToPath(import.meta.url)), "..", "seed");

describe("theme kits", () => {
  let root: string;
  let backupDir: string;
  let users: UserStore;
  let sessions: SessionStore;
  let site: SiteStore;
  let token: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "tessera-themes-"));
    backupDir = join(root, "backup");
    await mkdir(backupDir, { recursive: true });
    await mkdir(join(root, "users"), { recursive: true });
    await writeFile(join(root, "meta.json"), '{"schemaVersion":1}\n');
    users = new UserStore(join(root, "users"));
    await users.load();
    const password = await hashPassword("secret1");
    await users.createUser("alice", password.hash, password.salt);
    sessions = new SessionStore();
    token = sessions.create("alice").token;
    site = new SiteStore(join(root, "records"), join(root, "publish", "data", "site.json"));
    await writeSeedFiles(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function app() {
    return createApp({
      users,
      sessions,
      site,
      siteRoot: root,
      backupDir,
      seedDir,
    });
  }

  it("lists theme kits from seed", async () => {
    const res = await app().request("/api/themes", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { kits: { id: string }[] };
    const ids = body.kits.map((k) => k.id).sort();
    expect(ids).toEqual(["millers-ark", "tessera-w3-alt", "tessera-w3-starter"]);
  });

  it("apply leaves content unchanged and updates shell css", async () => {
    const edited = `id: home
title: Hello world
type: standard
zones:
  title:
    html: Hello world
  main:
    html: '<p>Unique body for theme test.</p>'
`;
    await writeFile(join(root, "records", "content", "home.yaml"), edited);

    const res = await app().request("/api/themes/tessera-w3-alt/apply", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    expect(await readFile(join(root, "records", "content", "home.yaml"), "utf8")).toBe(edited);

    const css = await readFile(join(root, "shell", "site.css"), "utf8");
    expect(css).toContain("Tessera W3 alternate kit");
  });

  it("apply starter then alt keeps main content painting", async () => {
    await applyThemeKit(root, backupDir, seedDir, "tessera-w3-starter");
    const homePath = join(root, "records", "content", "home.yaml");
    const homeBefore = await readFile(homePath, "utf8");

    await applyThemeKit(root, backupDir, seedDir, "tessera-w3-alt");
    expect(await readFile(homePath, "utf8")).toBe(homeBefore);

    const doc = await site.flatten();
    expect(doc).toBeTruthy();
    const home = doc!.pages.find((p) => p.id === "home");
    expect(home?.zones.main?.[0]).toMatchObject({ type: "text" });
  });

  it("optional demo import adds demo page without touching home", async () => {
    const homeBefore = await readFile(join(root, "records", "content", "home.yaml"), "utf8");
    const res = await app().request("/api/themes/tessera-w3-starter/apply", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ importDemo: true }),
    });
    expect(res.status).toBe(200);
    expect(await readFile(join(root, "records", "content", "home.yaml"), "utf8")).toBe(homeBefore);
    const demo = await readFile(join(root, "records", "content", "demo-home.yaml"), "utf8");
    expect(demo).toContain("Theme demo page");
  });

  it("reset-demo removes kit demo paths only", async () => {
    await applyThemeKit(root, backupDir, seedDir, "tessera-w3-starter", { importDemo: true });
    const homeBefore = await readFile(join(root, "records", "content", "home.yaml"), "utf8");
    const res = await app().request("/api/themes/tessera-w3-starter/reset-demo", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(await readFile(join(root, "records", "content", "home.yaml"), "utf8")).toBe(homeBefore);
    await expect(readFile(join(root, "records", "content", "demo-home.yaml"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("apply replaces the aspect catalog and leaves page aspectId alone", async () => {
    const fixtureSeed = join(root, "fixture-seed");
    const kitRoot = join(fixtureSeed, "themes", "aspect-kit");
    await mkdir(join(kitRoot, "shell"), { recursive: true });
    await writeFile(
      join(kitRoot, "manifest.yaml"),
      `id: aspect-kit
name: Aspect kit
version: 1
stack: custom
aspects:
  - id: day
    label: Day
  - id: night
    label: Night
defaultAspectId: day
patch:
  layouts: skip
  shell: skip
  site: merge-keys
  types: skip
  items: skip
  nav: skip
`,
    );

    await writeFile(
      join(root, "records", "content", "about.yaml"),
      `id: about
title: About
aspectId: night
zones:
  main:
    html: '<p>About</p>'
`,
    );

    await applyThemeKit(root, backupDir, fixtureSeed, "aspect-kit");
    const siteYaml = await readFile(join(root, "records", "site.yaml"), "utf8");
    expect(siteYaml).toContain("defaultAspectId: day");
    expect(siteYaml).toContain("id: day");
    expect(siteYaml).toContain("id: night");
    expect(await readFile(join(root, "records", "content", "about.yaml"), "utf8")).toContain("aspectId: night");

    await applyThemeKit(root, backupDir, seedDir, "tessera-w3-starter");
    const cleared = await readFile(join(root, "records", "site.yaml"), "utf8");
    expect(cleared).not.toContain("defaultAspectId");
    expect(cleared).not.toMatch(/^aspects:/m);
    expect(await readFile(join(root, "records", "content", "about.yaml"), "utf8")).toContain("aspectId: night");
  });
});
