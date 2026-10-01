import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
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

  it("renames a user, including a case-only change, and reloads that file", async () => {
    const dataDir = await siteDir();
    const store = new UserStore(dataDir);
    await store.load();
    const password = await hashPassword("secret1");
    await store.createUser("alice", password.hash, password.salt);
    await store.renameUser("alice", "Alice");

    const files = (await readdir(join(dataDir, "users"))).filter((name) => name.endsWith(".json"));
    expect(files.map((name) => name.toLowerCase())).toEqual(["alice.json"]);
    expect(files).toContain("Alice.json");

    const reloaded = new UserStore(dataDir);
    await reloaded.load();
    expect(reloaded.getUser("Alice")?.username).toBe("Alice");
    expect(reloaded.getUser("alice")).toBeUndefined();
    expect(reloaded.findUser("ALICE")?.username).toBe("Alice");
  });

  it("rejects a clash, a bad name, and a delete", async () => {
    const dataDir = await siteDir();
    const store = new UserStore(dataDir);
    await store.load();
    const password = await hashPassword("secret1");
    await store.createUser("alice", password.hash, password.salt);
    await store.createUser("bob", password.hash, password.salt);

    await expect(store.createUser("BOB", password.hash, password.salt)).rejects.toThrow(
      "Username already taken",
    );
    await expect(store.renameUser("alice", "bob")).rejects.toThrow("Username already taken");
    await expect(store.createUser("  ", password.hash, password.salt)).rejects.toThrow(
      "visible character",
    );
    await expect(store.createUser("1bob", password.hash, password.salt)).rejects.toThrow(
      "start with a letter",
    );

    await store.setDisabled("bob", true);
    expect(store.getUser("bob")?.disabled).toBe(true);
    const raw = await readFile(join(dataDir, "users", "bob.json"), "utf8");
    expect(raw).toContain('"disabled": true');
    await store.setDisabled("bob", false);
    expect(store.getUser("bob")?.disabled).toBeUndefined();
    expect(await readFile(join(dataDir, "users", "bob.json"), "utf8")).not.toContain("disabled");

    await store.deleteUser("bob");
    expect(store.getUser("bob")).toBeUndefined();
    const left = await readdir(join(dataDir, "users"));
    expect(left).not.toContain("bob.json");
  });
});
