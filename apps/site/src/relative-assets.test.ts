import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import config, { devShellHtml } from "../vite.config.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const siteNames = ["pure", "ineffable", "millersark", "willow"] as const;

describe("static site relative assets", () => {
  it("uses a subdirectory-relative base", () => {
    expect(config.base).toBe("./");
  });

  it("rewrites the stable runtime script for the dev server", () => {
    const html = devShellHtml(`<script type="module" src="./tessera.js"></script>`);
    expect(html).toContain('src="/src/main.ts"');
    expect(html).not.toContain("./tessera.js");
  });

  it.each(siteNames)("%s publish shell references assets relatively", (name) => {
    const html = readFileSync(join(repoRoot, "sites", name, "publish", "index.html"), "utf8");
    expect(html).toContain('src="./tessera.js"');
    expect(html).toMatch(/href="\.\/skin\/w3\.css"/);
    expect(html).toMatch(/href="\.\/site\.css"/);
    expect(html).not.toMatch(/(?:src|href)="\/(?!\/)/);
    expect(html).toMatch(/name="tessera-site" content="\.\/data\/site\.[a-f0-9]+\.json"/);
  });

  it.each(siteNames)("%s document uses relative media URLs", (name) => {
    const site = JSON.parse(
      readFileSync(join(repoRoot, "sites", name, "publish", "data", "site.json"), "utf8"),
    ) as { media?: { url?: string }[]; folders?: { path?: string }[] };
    for (const media of site.media ?? []) {
      if (typeof media.url !== "string") continue;
      expect(media.url).not.toMatch(/^https?:\/\//);
      expect(media.url.startsWith("/")).toBe(false);
    }
    for (const folder of site.folders ?? []) {
      expect(String(folder.path ?? "").startsWith("/")).toBe(false);
    }
  });

  it.each(siteNames)("%s shell loads the shared runtime", (name) => {
    const shell = readFileSync(join(repoRoot, "sites", name, "shell", "index.html"), "utf8");
    expect(shell).toMatch(/name="tessera-site" content="\.\/data\/site\.[a-f0-9]+\.json"/);
    expect(shell).toContain('src="./tessera.js"');
    expect(shell).not.toContain("main.ts");
  });

  it("runtime reads the document URL from the meta tag", () => {
    const main = readFileSync(join(repoRoot, "apps", "site", "src", "main.ts"), "utf8");
    expect(main).toContain("readSiteDocumentUrl()");
    expect(main).not.toContain('"./data/site.json"');
    expect(main).not.toContain('documentUrl: "/');
  });
});
