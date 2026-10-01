import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("editor at the hostname root", () => {
  it("vite config serves the editor at the domain root", async () => {
    const config = await import("../vite.config.ts");
    expect(config.default.base).toBe("/");
  });

  it("built index.html references assets from the domain root", () => {
    const html = readFileSync(join(root, "dist/index.html"), "utf8");
    expect(html).toMatch(/src="\/assets\/[^"]+\.js"/);
    expect(html).toMatch(/href="\/assets\/[^"]+\.css"/);
    expect(html).not.toMatch(/(?:src|href)="\.\/assets\//);
  });

  it("calls the API at the domain root", () => {
    const src = readFileSync(join(root, "src/api.ts"), "utf8");
    expect(src).toContain('request("/auth/login"');
    expect(src).toContain('request("/auth/me")');
    expect(src).toContain('request("/auth/logout"');
    expect(src).toContain('request("/auth/password"');
    expect(src).toContain('request("/auth/username"');
    expect(src).toContain('request("/api/users"');
    expect(src).toContain('request("/api/ping"');
    expect(src).toContain('request("/api/records")');
    expect(src).not.toContain("resolveApiUrl");
    expect(src).not.toContain("directoryUrl");
  });
});
