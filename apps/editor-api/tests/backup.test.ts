import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import * as blank from "../src/site/blank.js";
import {
  createDataBackup,
  ensureExampleArchives,
  listBackups,
  listExamples,
  reseedSite,
  restoreDataBackup,
  restoreExample,
} from "../src/site/backup.js";
import { UserStore } from "../src/store/users.js";

describe("site backups", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function tempDir(prefix: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), prefix));
    dirs.push(dir);
    return dir;
  }

  async function writePackedExample(seedDir: string, title: string): Promise<void> {
    const source = await tempDir("tessera-packed-");
    await mkdir(join(source, "records"), { recursive: true });
    await writeFile(join(source, "meta.json"), `{"schemaVersion":1,"from":"${title}"}\n`);
    await writeFile(join(source, "records", "site.yaml"), `title: ${title}\n`);
    const scratch = await tempDir("tessera-packed-out-");
    const created = await createDataBackup(source, scratch);
    const examples = join(seedDir, "examples");
    await mkdir(examples, { recursive: true });
    await cp(join(scratch, created.name), join(examples, "willow.tar.gz"));
  }

  async function siteWith(page: string): Promise<{ site: string; backup: string }> {
    const parent = await tempDir("tessera-site-");
    const site = join(parent, "data");
    const backup = join(parent, "backup");
    await mkdir(join(site, "records"), { recursive: true });
    await writeFile(join(site, "meta.json"), '{"schemaVersion":1}\n');
    await writeFile(join(site, "records", "site.yaml"), `title: ${page}\n`);
    await mkdir(join(site, "users"), { recursive: true });
    await writeFile(join(site, "users", "admin.json"), '{"username":"admin"}\n');
    return { site, backup };
  }

  it("writes a dated archive and restores it after a safety copy", async () => {
    const { site, backup } = await siteWith("Before");
    const created = await createDataBackup(site, backup);
    expect(created.name).toMatch(/^\d{4}-\d{2}-\d{2}T\d{6}Z\.tar\.gz$/);

    await writeFile(join(site, "records", "site.yaml"), "title: After\n");
    const result = await restoreDataBackup(site, backup, created.name);
    expect(result.safetyBackup).not.toBe(created.name);
    expect(await readFile(join(site, "records", "site.yaml"), "utf8")).toBe("title: Before\n");
    expect(await readFile(join(site, "users", "admin.json"), "utf8")).toContain("admin");

    const names = (await listBackups(backup)).map((item) => item.name);
    expect(names).toContain(created.name);
    expect(names).toContain(result.safetyBackup);
  });

  it("moves records out of a restored data/ folder", async () => {
    const parent = await tempDir("tessera-legacy-");
    const site = join(parent, "data");
    const backup = join(parent, "backup");
    await mkdir(join(site, "data"), { recursive: true });
    await writeFile(join(site, "meta.json"), '{"schemaVersion":1}\n');
    await writeFile(join(site, "data", "site.yaml"), "title: Legacy\n");
    const created = await createDataBackup(site, backup);
    await rm(join(site, "data"), { recursive: true });
    await restoreDataBackup(site, backup, created.name);
    expect(await readFile(join(site, "records", "site.yaml"), "utf8")).toBe("title: Legacy\n");
  });

  it("rejects an archive that is not a site", async () => {
    const { site, backup } = await siteWith("Before");
    const other = await tempDir("tessera-not-site-");
    await writeFile(join(other, "note.txt"), "nope\n");
    const created = await createDataBackup(other, backup);
    await expect(restoreDataBackup(site, backup, created.name)).rejects.toThrow(/meta\.json/);
    expect(await readFile(join(site, "records", "site.yaml"), "utf8")).toContain("Before");
  });

  it("archives a demo into the backup folder once and restores it without replacing editors", async () => {
    const { site, backup } = await siteWith("Live");
    const sources = await tempDir("tessera-sources-");
    const willow = join(sources, "willow");
    await mkdir(join(willow, "records"), { recursive: true });
    await writeFile(join(willow, "meta.json"), '{"schemaVersion":1,"from":"willow"}\n');
    await writeFile(join(willow, "records", "site.yaml"), "title: Willow\n");
    await mkdir(join(willow, "users"), { recursive: true });
    await writeFile(join(willow, "users", "admin.json"), '{"username":"intruder"}\n');

    await ensureExampleArchives(backup, { sitesDir: sources });
    await writeFile(join(willow, "records", "site.yaml"), "title: Changed source\n");
    await ensureExampleArchives(backup, { sitesDir: sources });

    const found = await listExamples(backup);
    expect(found.map((item) => item.name)).toContain("willow");
    expect((await listBackups(backup)).some((item) => item.name === "willow.tar.gz")).toBe(false);

    await restoreExample(site, backup, "willow");
    expect(await readFile(join(site, "records", "site.yaml"), "utf8")).toBe("title: Willow\n");
    expect(await readFile(join(site, "users", "admin.json"), "utf8")).toContain("admin");
    expect(await readFile(join(site, "meta.json"), "utf8")).toContain("willow");
  });

  it("replaces the example archive when a later release ships different bytes", async () => {
    const { site, backup } = await siteWith("Live");
    await mkdir(backup, { recursive: true });
    await writeFile(join(backup, "2026-01-01T000000Z.tar.gz"), "keep\n");
    const seed = await tempDir("tessera-seed-");

    await writePackedExample(seed, "First");
    await ensureExampleArchives(backup, { seedDir: seed });
    const installed = await stat(join(backup, "willow.tar.gz"));

    await ensureExampleArchives(backup, { seedDir: seed });
    expect((await stat(join(backup, "willow.tar.gz"))).mtimeMs).toBe(installed.mtimeMs);

    await writePackedExample(seed, "Second");
    await ensureExampleArchives(backup, { seedDir: seed });
    expect(await readFile(join(backup, "2026-01-01T000000Z.tar.gz"), "utf8")).toBe("keep\n");

    await restoreExample(site, backup, "willow");
    expect(await readFile(join(site, "records", "site.yaml"), "utf8")).toBe("title: Second\n");
    expect(await readFile(join(site, "users", "admin.json"), "utf8")).toContain("admin");
  });

  it("re-seeds over the current site and rolls back when the seed cannot be written", async () => {
    const { site, backup } = await siteWith("Before");
    await mkdir(join(site, "publish"), { recursive: true });
    await writeFile(join(site, "publish", "old.txt"), "published\n");
    await writeFile(join(site, ".sessions.json"), '{"keep":true}\n');

    const result = await reseedSite(site, backup);
    expect(result.restored).toBe("seed");
    expect(await readFile(join(site, "records", "content", "home.yaml"), "utf8")).toContain("Hello world");
    expect(await readFile(join(site, "records", "items", "common-footer.yaml"), "utf8")).toContain("footer");
    expect(await readFile(join(site, "users", "admin.json"), "utf8")).toContain("admin");
    expect(await readFile(join(site, "meta.json"), "utf8")).toContain("schemaVersion");
    expect(await readFile(join(site, ".sessions.json"), "utf8")).toContain("keep");
    await expect(readFile(join(site, "publish", "old.txt"), "utf8")).rejects.toThrow();

    const again = await siteWith("Before");
    const spy = vi.spyOn(blank, "writeSeedFiles").mockRejectedValueOnce(new Error("disk full"));
    await expect(reseedSite(again.site, again.backup)).rejects.toThrow(/disk full/);
    expect(await readFile(join(again.site, "records", "site.yaml"), "utf8")).toContain("Before");
    expect(await readFile(join(again.site, "users", "admin.json"), "utf8")).toContain("admin");
    spy.mockRestore();
  });

  it("requires an editor to list backups", async () => {
    const parent = await tempDir("tessera-http-");
    const site = join(parent, "data");
    const backup = join(parent, "backup");
    await mkdir(site, { recursive: true });
    const users = new UserStore(site);
    await users.load();
    const password = await hashPassword("secret1");
    await users.createUser("alice", password.hash, password.salt);
    const sessions = new SessionStore();
    const token = sessions.create("alice").token;
    const app = createApp({
      users,
      sessions,
      siteRoot: site,
      backupDir: backup,
      seedDir: join(parent, "seed"),
    });

    expect((await app.request("/api/backups")).status).toBe(401);
    const listed = await app.request("/api/backups", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as { ok: boolean; directory: string; backups: unknown[] };
    expect(body.ok).toBe(true);
    expect(body.directory).toBe(backup);
    expect(body.backups).toEqual([]);
  });
});
