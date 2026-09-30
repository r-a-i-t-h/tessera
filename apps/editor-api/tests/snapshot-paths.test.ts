import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { shellIndexPaths, writeSnapshotFiles } from "../src/site/snapshot.js";

describe("snapshot stamp paths", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("stamps the authoring shell from a preview snapshot and leaves publish alone", async () => {
    const root = await mkdtemp(join(tmpdir(), "tessera-preview-"));
    dirs.push(root);
    const shell = join(root, "shell", "index.html");
    const publishIndex = join(root, "publish", "index.html");
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(root, "shell"), { recursive: true });
    await mkdir(join(root, "publish"), { recursive: true });
    const html = `<meta name="tessera-site" content="./data/site.json" />\n`;
    await writeFile(shell, html);
    await writeFile(publishIndex, html);

    const previewOut = join(root, "preview", "data", "site.json");
    expect(shellIndexPaths(previewOut)).toEqual([shell]);
    const rev = await writeSnapshotFiles(previewOut, '{"version":2}\n');
    const stamped = await readFile(shell, "utf8");
    expect(stamped).toContain(`./data/${rev.file}`);
    expect(await readFile(publishIndex, "utf8")).toBe(html);
  });

  it("stamps the dist index from a publish snapshot and leaves the shell alone", async () => {
    const root = await mkdtemp(join(tmpdir(), "tessera-publish-"));
    dirs.push(root);
    const shell = join(root, "shell", "index.html");
    const publishIndex = join(root, "publish", "index.html");
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(join(root, "shell"), { recursive: true });
    await mkdir(join(root, "publish"), { recursive: true });
    const html = `<meta name="tessera-site" content="./data/site.json" />\n`;
    await writeFile(shell, html);
    await writeFile(publishIndex, html);

    const publishOut = join(root, "publish", "data", "site.json");
    expect(shellIndexPaths(publishOut)).toEqual([publishIndex]);
    const rev = await writeSnapshotFiles(publishOut, '{"version":2}\n');
    expect(await readFile(publishIndex, "utf8")).toContain(`./data/${rev.file}`);
    expect(await readFile(shell, "utf8")).toBe(html);
  });
});