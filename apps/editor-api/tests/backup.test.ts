import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import {
  createDataBackup,
  ensureExampleArchives,
  listBackups,
  listExamples,
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
