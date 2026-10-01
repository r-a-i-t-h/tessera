import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { apiRootFromModule, resolveRuntimeDirs, resolveSpaDir } from "../src/site/paths.js";

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

  it("reads the site runtime shipped beside a release", async () => {
    const release = await mkdtemp(join(tmpdir(), "tessera-release-"));
    dirs.push(release);
    await mkdir(join(release, "runtime"), { recursive: true });
    await mkdir(join(release, "skin"), { recursive: true });
    await writeFile(join(release, "runtime", "tessera.js"), "export {}\n");
    await writeFile(join(release, "skin", "w3.css"), "body{}\n");
    expect(resolveRuntimeDirs(release, release)).toEqual({
      bundleDir: join(release, "runtime"),
      skinDir: join(release, "skin"),
    });
  });

  it("points a release with no build at runtime/ and skin/", async () => {
    const release = await mkdtemp(join(tmpdir(), "tessera-release-"));
    dirs.push(release);
    expect(resolveRuntimeDirs(release, release)).toEqual({
      bundleDir: join(release, "runtime"),
      skinDir: join(release, "skin"),
    });
  });

  it("prefers the checkout build over a runtime directory next to the API", async () => {
    const checkout = await mkdtemp(join(tmpdir(), "tessera-checkout-"));
    dirs.push(checkout);
    const apiRoot = join(checkout, "apps", "editor-api");
    const built = join(checkout, "apps", "site", "dist");
    await mkdir(join(checkout, "sites"), { recursive: true });
    await mkdir(built, { recursive: true });
    await mkdir(join(checkout, "packages", "skin-w3", "css"), { recursive: true });
    await mkdir(join(apiRoot, "runtime"), { recursive: true });
    await writeFile(join(built, "tessera.js"), "export {}\n");
    await writeFile(join(checkout, "packages", "skin-w3", "css", "w3.css"), "body{}\n");
    await writeFile(join(apiRoot, "runtime", "tessera.js"), "export {}\n");
    expect(resolveRuntimeDirs(apiRoot, checkout)).toEqual({
      bundleDir: built,
      skinDir: join(checkout, "packages", "skin-w3", "css"),
    });
  });

  it("points a checkout with no build at apps/site/dist", async () => {
    const checkout = await mkdtemp(join(tmpdir(), "tessera-checkout-"));
    dirs.push(checkout);
    const apiRoot = join(checkout, "apps", "editor-api");
    await mkdir(join(checkout, "sites"), { recursive: true });
    await mkdir(join(checkout, "packages", "skin-w3", "css"), { recursive: true });
    expect(resolveRuntimeDirs(apiRoot, checkout)).toEqual({
      bundleDir: join(checkout, "apps", "site", "dist"),
      skinDir: join(checkout, "packages", "skin-w3", "css"),
    });
  });
});
