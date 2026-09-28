import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "../src/auth/password.js";
import { UserStore } from "../src/store/users.js";

const seedDir = join(dirname(fileURLToPath(import.meta.url)), "..", "seed");

describe("UserStore seed load", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function siteDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "tessera-users-"));
    dirs.push(dir);
    return dir;
  }

  it("copies seed users into an empty data dir", async () => {
    const dataDir = await siteDir();
    const store = new UserStore(dataDir);
    await store.load(seedDir);
    expect(store.getUser("admin")?.username).toBe("admin");
    const files = await readdir(join(dataDir, "users"));
    expect(files).toContain("admin.json");
  });

  it("keeps a changed password in that site and leaves the seed site alone", async () => {
    const changed = await siteDir();
    const other = await siteDir();
    const changedStore = new UserStore(changed);
    const otherStore = new UserStore(other);
    await changedStore.load(seedDir);
    await otherStore.load(seedDir);
    const seededHash = otherStore.getUser("admin")?.passwordHash;

    const next = await hashPassword("changed-password");
    await changedStore.updatePassword("admin", next.hash, next.salt);

    const reloaded = new UserStore(changed);
    await reloaded.load(seedDir);
    expect(reloaded.getUser("admin")?.passwordHash).toBe(next.hash);

    const otherReloaded = new UserStore(other);
    await otherReloaded.load(seedDir);
    expect(otherReloaded.getUser("admin")?.passwordHash).toBe(seededHash);
    expect(seededHash).not.toBe(next.hash);
  });
});
