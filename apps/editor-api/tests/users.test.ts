import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { UserStore } from "../src/store/users.js";

const seedDir = join(dirname(fileURLToPath(import.meta.url)), "..", "seed");

describe("UserStore seed load", () => {
  let dataDir: string;

  afterEach(async () => {
    if (dataDir) await rm(dataDir, { recursive: true, force: true });
  });

  it("copies seed users into an empty data dir", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-users-"));
    const store = new UserStore(dataDir);
    await store.load(seedDir);
    expect(store.getUser("admin")?.username).toBe("admin");
    const files = await readdir(join(dataDir, "users"));
    expect(files).toContain("admin.json");
  });
});
