import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resetUserPassword } from "../src/admin/reset-user-password.js";
import { verifyPassword } from "../src/auth/password.js";
import { UserStore } from "../src/store/users.js";

describe("resetUserPassword", () => {
  let dataDir: string;

  afterEach(async () => {
    if (dataDir) await rm(dataDir, { recursive: true, force: true });
  });

  it("updates the stored hash for an existing user", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-reset-pw-"));
    const users = new UserStore(dataDir);
    await users.load();
    const before = await import("../src/auth/password.js").then((m) => m.hashPassword("old-secret"));
    await users.createUser("alice", before.hash, before.salt);

    const name = await resetUserPassword(dataDir, "Alice", "new-secret");
    expect(name).toBe("alice");

    const reloaded = new UserStore(dataDir);
    await reloaded.load();
    const record = reloaded.getUser("alice");
    expect(record).toBeDefined();
    expect(await verifyPassword("new-secret", record!.passwordHash, record!.passwordSalt)).toBe(true);
    expect(await verifyPassword("old-secret", record!.passwordHash, record!.passwordSalt)).toBe(false);
  });

  it("rejects unknown users and short passwords", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-reset-pw-"));
    await expect(resetUserPassword(dataDir, "nobody", "long-enough")).rejects.toThrow(/not found/i);
    await expect(resetUserPassword(dataDir, "alice", "short")).rejects.toThrow(/6 characters/i);
  });
});
