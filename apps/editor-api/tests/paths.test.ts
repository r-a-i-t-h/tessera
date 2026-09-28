import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { apiRootFromModule, resolveSpaDir } from "../src/site/paths.js";

describe("release paths", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("finds the API root from source layout and from a bundled server", () => {
    expect(apiRootFromModule("/repo/apps/editor-api/src/site")).toBe("/repo/apps/editor-api");
    expect(apiRootFromModule("/repo/apps/editor-api/dist/site")).toBe("/repo/apps/editor-api");
    expect(apiRootFromModule("/opt/tessera/willow/current/dist")).toBe("/opt/tessera/willow/current");
  });

  it("serves spa/ from a release and the editor build from a checkout", async () => {
    const release = await mkdtemp(join(tmpdir(), "tessera-release-"));
    dirs.push(release);
    await mkdir(join(release, "spa"), { recursive: true });
    await writeFile(join(release, "spa", "index.html"), "<title>Editor</title>");
    expect(resolveSpaDir(release, "")).toBe(join(release, "spa"));

    const checkout = await mkdtemp(join(tmpdir(), "tessera-checkout-"));
    dirs.push(checkout);
    const apiRoot = join(checkout, "apps", "editor-api");
    const editorDist = join(checkout, "apps", "editor", "dist");
    await mkdir(editorDist, { recursive: true });
    await writeFile(join(editorDist, "index.html"), "<title>Dev</title>");
    expect(resolveSpaDir(apiRoot, "")).toBe(editorDist);

    expect(resolveSpaDir(apiRoot, join(release, "spa"))).toBe(join(release, "spa"));
    expect(resolveSpaDir(apiRoot, join(release, "missing"))).toBeUndefined();
  });
});
