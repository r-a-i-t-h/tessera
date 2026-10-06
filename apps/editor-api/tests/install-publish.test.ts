import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { installPublish } from "../src/site/install-publish.js";

describe("installPublish", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function layout() {
    const root = await mkdtemp(join(tmpdir(), "tessera-install-"));
    dirs.push(root);
    const instance = join(root, "site");
    const publish = join(instance, "publish");
    const live = join(root, "www");
    await mkdir(publish, { recursive: true });
    await mkdir(live, { recursive: true });
    await writeFile(join(publish, "index.html"), "<p>Welcome</p>\n");
    await mkdir(join(publish, "about"));
    await writeFile(join(publish, "about", "index.html"), "<p>About</p>\n");
    return { root, instance, publish, live };
  }

  it("replaces the live files and leaves the directory and publish/ in place", async () => {
    const { publish, live, instance } = await layout();
    await writeFile(join(live, "index.html"), "<p>old</p>\n");
    await mkdir(join(live, ".well-known", "acme"), { recursive: true });
    await writeFile(join(live, ".well-known", "acme", "token"), "gone\n");
    const outside = join(instance, "outside.txt");
    await writeFile(outside, "keep\n");
    await symlink(outside, join(live, "linked.txt"));
    const before = await lstat(live);

    const installed = await installPublish(publish, live, instance);

    expect(installed).toBe(live);
    expect((await lstat(live)).ino).toBe(before.ino);
    expect(await readFile(join(live, "index.html"), "utf8")).toContain("Welcome");
    expect(await readFile(join(live, "about", "index.html"), "utf8")).toContain("About");
    await expect(lstat(join(live, ".well-known"))).rejects.toThrow();
    await expect(lstat(join(live, "linked.txt"))).rejects.toThrow();
    await expect(lstat(join(live, ".tessera-incoming"))).rejects.toThrow();
    expect(await readFile(outside, "utf8")).toBe("keep\n");
    expect(await readFile(join(publish, "index.html"), "utf8")).toContain("Welcome");
  });

  it("leaves the current pages in place when the copy fails", async () => {
    const { publish, live, instance } = await layout();
    await writeFile(join(live, "index.html"), "<p>current</p>\n");
    const locked = join(publish, "locked");
    await mkdir(locked);
    await writeFile(join(locked, "secret.txt"), "nope\n");
    await chmod(locked, 0o000);
    try {
      await expect(installPublish(publish, live, instance)).rejects.toThrow(/left unchanged/);
      expect(await readFile(join(live, "index.html"), "utf8")).toContain("current");
      await expect(lstat(join(live, ".tessera-incoming"))).rejects.toThrow();
    } finally {
      await chmod(locked, 0o755);
    }
  });

  it("does not create a missing directory", async () => {
    const { publish, instance, root } = await layout();
    const missing = join(root, "missing");
    await expect(installPublish(publish, missing, instance)).rejects.toThrow(/does not exist/);
    await expect(lstat(missing)).rejects.toThrow();
  });

  it("rejects a relative path, dot segments, a symlink, and a file", async () => {
    const { publish, live, instance, root } = await layout();
    await writeFile(join(live, "index.html"), "<p>stay</p>\n");
    await expect(installPublish(publish, "www", instance)).rejects.toThrow(/absolute/);
    await expect(installPublish(publish, `${live}/../www`, instance)).rejects.toThrow(/path segments/);
    const link = join(root, "live-link");
    await symlink(live, link);
    await expect(installPublish(publish, link, instance)).rejects.toThrow(/symlink/);
    const file = join(root, "not-dir");
    await writeFile(file, "x\n");
    await expect(installPublish(publish, file, instance)).rejects.toThrow(/directory/);
    expect(await readFile(join(live, "index.html"), "utf8")).toContain("stay");
  });

  it("rejects a directory inside the site or one that contains it", async () => {
    const { publish, instance, root } = await layout();
    const inside = join(instance, "public");
    await mkdir(inside);
    await writeFile(join(inside, "index.html"), "<p>stay</p>\n");
    await writeFile(join(root, "marker.txt"), "keep\n");
    await expect(installPublish(publish, inside, instance)).rejects.toThrow(/outside this site/);
    await expect(installPublish(publish, root, instance)).rejects.toThrow(/outside this site/);
    expect(await readFile(join(inside, "index.html"), "utf8")).toContain("stay");
    expect(await readFile(join(root, "marker.txt"), "utf8")).toBe("keep\n");
    await expect(lstat(join(root, ".tessera-incoming"))).rejects.toThrow();
    await expect(lstat(join(inside, ".tessera-incoming"))).rejects.toThrow();
  });

  it("rejects a directory this process cannot write", async () => {
    const { publish, live, instance } = await layout();
    await writeFile(join(live, "index.html"), "<p>stay</p>\n");
    await chmod(live, 0o555);
    try {
      await expect(installPublish(publish, live, instance)).rejects.toThrow(/cannot write/);
      expect(await readFile(join(live, "index.html"), "utf8")).toContain("stay");
      await expect(lstat(join(live, ".tessera-incoming"))).rejects.toThrow();
    } finally {
      await chmod(live, 0o755);
    }
  });
});
