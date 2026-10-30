import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import config, { devShellHtml } from "../vite.config.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const starterShell = join(repoRoot, "apps", "editor-api", "seed", "themes", "tessera-w3-starter", "shell", "index.html");

describe("static site relative assets", () => {
  it("uses a subdirectory-relative base", () => {
    expect(config.base).toBe("./");
  });

  it("rewrites the stable runtime script for the dev server", () => {
    const html = devShellHtml(`<script type="module" src="./tessera.js"></script>`);
    expect(html).toContain('src="/src/main.ts"');
    expect(html).not.toContain("./tessera.js");
  });

  it("starter shell references assets relatively", () => {
    const html = readFileSync(starterShell, "utf8");
    expect(html).toContain('src="./tessera.js"');
    expect(html).toMatch(/href="\.\/skin\/w3\.css"/);
    expect(html).toMatch(/href="\.\/site\.css"/);
    expect(html).not.toMatch(/(?:src|href)="\/(?!\/)/);
    expect(html).toMatch(/name="tessera-site" content="\.\/data\/site\.json"/);
  });

  it("starter shell loads the shared runtime", () => {
    const shell = readFileSync(starterShell, "utf8");
    expect(shell).toMatch(/name="tessera-site" content="\.\/data\/site\.json"/);
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
