import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import config from "../vite.config.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const siteNames = ["pure", "ineffable", "millersark", "willow"] as const;

describe("static site relative assets", () => {
  it("uses a subdirectory-relative base", () => {
    expect(config.base).toBe("./");
  });

  it.each(siteNames)("%s publish shell references assets relatively", (name) => {
    const html = readFileSync(join(repoRoot, "sites", name, "publish", "index.html"), "utf8");
    expect(html).toMatch(/src="\.\/assets\/[^"]+\.js"/);
    expect(html).toMatch(/href="\.\/assets\/[^"]+\.css"/);
    expect(html).not.toMatch(/(?:src|href)="\/assets\//);
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

  it.each(siteNames)("%s shell loads the document from the meta tag", (name) => {
    const shell = readFileSync(join(repoRoot, "sites", name, "shell", "index.html"), "utf8");
    expect(shell).toMatch(/name="tessera-site" content="\.\/data\/site\.[a-f0-9]+\.json"/);
    const main = readFileSync(join(repoRoot, "sites", name, "shell", "main.ts"), "utf8");
    expect(main).toContain("readSiteDocumentUrl()");
    expect(main).not.toContain('"./data/site.json"');
    expect(main).not.toContain('documentUrl: "/');
  });
});
