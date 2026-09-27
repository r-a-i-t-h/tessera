import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("static site relative assets", () => {
  it("vite config uses subdirectory-relative base", async () => {
    const config = await import("../vite.config.ts");
    expect(config.default.base).toBe("./");
  });

  it("built index.html references assets relatively", () => {
    const html = readFileSync(join(root, "dist/index.html"), "utf8");
    expect(html).toMatch(/src="\.\/assets\/[^"]+\.js"/);
    expect(html).toMatch(/href="\.\/assets\/[^"]+\.css"/);
    expect(html).not.toMatch(/(?:src|href)="\/assets\//);
  });

  it("site document uses relative media URLs", () => {
    const site = JSON.parse(readFileSync(join(root, "public/data/site.json"), "utf8"));
    for (const m of site.media ?? []) {
      expect(m.url).not.toMatch(/^https?:\/\//);
      expect(m.url.startsWith("/")).toBe(false);
    }
  });

  it("points the shell at a folder-relative hashed site file", () => {
    const pointer = /name="tessera-site" content="\.\/data\/site\.[a-f0-9]+\.json"/;
    expect(readFileSync(join(root, "index.html"), "utf8")).toMatch(pointer);
    expect(readFileSync(join(root, "dist/index.html"), "utf8")).toMatch(pointer);
    const main = readFileSync(join(root, "src/main.ts"), "utf8");
    expect(main).toContain("readSiteDocumentUrl()");
    expect(main).not.toContain('"./data/site.json"');
    expect(main).not.toContain('documentUrl: "/');
  });
});
