import { Buffer } from "node:buffer";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import { runTar } from "../src/site/backup.js";
import { writeSeedFiles } from "../src/site/blank.js";
import { applyThemeKit, loadThemeManifest } from "../src/site/theme-kit.js";
import { exportThemeKit } from "../src/site/theme-export.js";
import { SiteStore } from "../src/site/store.js";
import { UserStore } from "../src/store/users.js";

const seedDir = join(dirname(fileURLToPath(import.meta.url)), "..", "seed");

async function extractThemeArchive(bytes: Uint8Array, destDir: string): Promise<void> {
  const stage = await mkdtemp(join(tmpdir(), "tessera-theme-tar-"));
  const archive = join(stage, "kit.tar.gz");
  try {
    await writeFile(archive, bytes);
    await mkdir(destDir, { recursive: true });
    await runTar(["-xzf", archive, "-C", destDir]);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

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

  it("seeds panel tones and local.css once, then leaves them across theme apply", async () => {
    const homeBefore = await readFile(join(root, "records", "content", "home.yaml"), "utf8");
    await applyThemeKit(root, backupDir, seedDir, "millers-ark");
    const siteYaml = await readFile(join(root, "records", "site.yaml"), "utf8");
    expect(siteYaml).toContain("id: ma-blue");
    expect(siteYaml).toContain("className: ma-panel-blue");
    expect(siteYaml).toContain("id: ma-straw");
    const localCss = await readFile(join(root, "shell", "local.css"), "utf8");
    expect(localCss).toContain(".ma-panel-blue");
    expect(await readFile(join(root, "shell", "index.html"), "utf8")).toContain("./local.css");
    expect(await readFile(join(root, "records", "content", "home.yaml"), "utf8")).toBe(homeBefore);

    await writeFile(join(root, "shell", "local.css"), "/* designer tweak */\n.ma-panel-blue{outline:1px solid red}\n");
    await applyThemeKit(root, backupDir, seedDir, "tessera-w3-starter");
    const kept = await readFile(join(root, "records", "site.yaml"), "utf8");
    expect(kept).toContain("id: ma-blue");
    expect(kept).toContain("id: ma-straw");
    expect(await readFile(join(root, "shell", "local.css"), "utf8")).toContain("designer tweak");
    expect(await readFile(join(root, "records", "content", "home.yaml"), "utf8")).toBe(homeBefore);

    await applyThemeKit(root, backupDir, seedDir, "millers-ark");
    expect(await readFile(join(root, "shell", "local.css"), "utf8")).toContain("designer tweak");
    expect(await readFile(join(root, "records", "site.yaml"), "utf8")).toContain("id: ma-blue");
  });

  it("rejects a kit that declares panelTones on the manifest", async () => {
    const fixtureSeed = join(root, "fixture-seed-tones");
    const kitRoot = join(fixtureSeed, "themes", "tone-kit");
    await mkdir(join(kitRoot, "shell"), { recursive: true });
    await writeFile(
      join(kitRoot, "manifest.yaml"),
      `id: tone-kit
name: Tone kit
version: 1
stack: custom
panelTones:
  - id: ma-blue
    label: School blue
    className: ma-panel-blue
patch:
  layouts: skip
  shell: skip
  site: merge-keys
  types: skip
  items: skip
  nav: skip
`,
    );
    await expect(applyThemeKit(root, backupDir, fixtureSeed, "tone-kit")).rejects.toThrow(/panelTones/);
  });

  it("export builds a kit archive without content", async () => {
    const marker = "/* export-theme-marker */\n";
    await writeFile(join(root, "shell", "site.css"), marker);

    const bytes = await exportThemeKit(root, {
      id: "exported-kit",
      name: "Exported kit",
      stack: "w3",
    });
    expect(bytes.length).toBeGreaterThan(100);

    const extractRoot = await mkdtemp(join(tmpdir(), "tessera-theme-extract-"));
    try {
      await extractThemeArchive(bytes, extractRoot);
      const kitDir = join(extractRoot, "exported-kit");
      const manifest = parseYaml(await readFile(join(kitDir, "manifest.yaml"), "utf8")) as {
        id: string;
        patch: { layoutIds?: string[]; itemIds?: string[] };
      };
      expect(manifest.id).toBe("exported-kit");
      expect(manifest.patch.layoutIds).toContain("master");
      expect(manifest.patch.layoutIds).toContain("standard");
      expect(manifest.patch.itemIds).toContain("common-footer");
      expect(await readFile(join(kitDir, "shell", "site.css"), "utf8")).toBe(marker);
      await expect(readFile(join(kitDir, "records", "content", "home.yaml"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      await rm(extractRoot, { recursive: true, force: true });
    }
  });

  it("export then apply round-trips design without touching content", async () => {
    const marker = "/* round-trip-marker */\n";
    await writeFile(join(root, "shell", "site.css"), marker);
    const homeEdited = `id: home
title: Hello world
type: standard
zones:
  title:
    html: Hello world
  main:
    html: '<p>Round trip body.</p>'
`;
    await writeFile(join(root, "records", "content", "home.yaml"), homeEdited);

    const bytes = await exportThemeKit(root, {
      id: "round-trip-kit",
      name: "Round trip",
    });

    const exportSeed = await mkdtemp(join(tmpdir(), "tessera-export-seed-"));
    const target = await mkdtemp(join(tmpdir(), "tessera-round-trip-target-"));
    const targetBackup = join(target, "backup");
    try {
      await mkdir(targetBackup, { recursive: true });
      await extractThemeArchive(bytes, exportSeed);
      await mkdir(join(exportSeed, "themes"), { recursive: true });
      await cp(join(exportSeed, "round-trip-kit"), join(exportSeed, "themes", "round-trip-kit"), {
        recursive: true,
      });
      await loadThemeManifest(exportSeed, "round-trip-kit");

      await writeSeedFiles(target);
      await writeFile(join(target, "records", "content", "home.yaml"), homeEdited);

      await applyThemeKit(target, targetBackup, exportSeed, "round-trip-kit");
      expect(await readFile(join(target, "records", "content", "home.yaml"), "utf8")).toBe(homeEdited);
      expect(await readFile(join(target, "shell", "site.css"), "utf8")).toBe(marker);
    } finally {
      await rm(exportSeed, { recursive: true, force: true });
      await rm(target, { recursive: true, force: true });
    }
  });

  it("POST /api/themes/import installs a kit into seed themes", async () => {
    const importSeed = join(root, "import-seed");
    await cp(seedDir, importSeed, { recursive: true });

    const bytes = await exportThemeKit(root, {
      id: "imported-via-api",
      name: "Imported via API",
    });
    const body = new FormData();
    body.append(
      "file",
      new File([Buffer.from(bytes)], "imported-via-api.tar.gz", { type: "application/gzip" }),
    );

    const res = await createApp({
      users,
      sessions,
      site,
      siteRoot: root,
      backupDir,
      seedDir: importSeed,
    }).request("/api/themes/import", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { kit: { id: string; name: string } };
    expect(json.kit).toMatchObject({ id: "imported-via-api", name: "Imported via API" });

    const list = await createApp({
      users,
      sessions,
      site,
      siteRoot: root,
      backupDir,
      seedDir: importSeed,
    }).request("/api/themes", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const kits = ((await list.json()) as { kits: { id: string }[] }).kits.map((k) => k.id);
    expect(kits).toContain("imported-via-api");
  });

  it("POST /api/themes/export returns a gzip attachment", async () => {
    const res = await app().request("/api/themes/export", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: "api-export-kit", name: "API export" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/gzip");
    expect(res.headers.get("Content-Disposition")).toContain("api-export-kit.tar.gz");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(100);
  });
});
