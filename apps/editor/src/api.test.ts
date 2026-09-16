import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { directoryUrl, resolveApiUrl } from "./api.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("resolveApiUrl", () => {
  it("stays in the page directory for subdirectory hosts", () => {
    expect(resolveApiUrl("auth/login", "http://localhost:7355/")).toBe(
      "http://localhost:7355/auth/login",
    );
    expect(resolveApiUrl("auth/login", "http://localhost:7355/index.html")).toBe(
      "http://localhost:7355/auth/login",
    );
    expect(resolveApiUrl("api/ping", "http://example.com/tessera/")).toBe(
      "http://example.com/tessera/api/ping",
    );
    expect(resolveApiUrl("api/ping", "http://example.com/tessera")).toBe(
      "http://example.com/tessera/api/ping",
    );
  });

  it("treats a file path as a directory prefix", () => {
    expect(directoryUrl("http://example.com/tessera/index.html")).toBe(
      "http://example.com/tessera/",
    );
  });
});

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

  it("calls the API with relative paths, not domain-root URLs", () => {
    const src = readFileSync(join(root, "src/api.ts"), "utf8");
    expect(src).toContain('request("auth/login"');
    expect(src).toContain('request("auth/me")');
    expect(src).toContain('request("auth/logout"');
    expect(src).toContain('request("api/ping"');
    expect(src).toContain('request("api/records")');
    expect(src).not.toContain('"/auth/');
    expect(src).not.toContain('"/api/');
  });
});
