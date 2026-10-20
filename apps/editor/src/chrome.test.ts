// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import { announceRoute, editorChrome, loginView } from "./chrome.js";

describe("editor chrome", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("marks the current section and escapes the account name", () => {
    const html = editorChrome(
      { ok: true, username: "<Alice>", createdAt: "2026-01-01" },
      "<h1>Records</h1>",
      false,
      "records",
    );
    expect(html).toContain('href="#/records" aria-current="page"');
    expect(html).toContain('aria-label="Record types"');
    expect(html).toContain("&lt;Alice&gt;");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('class="editor-sidebar w3-theme"');
    expect(html).toContain("editor-nav-brand w3-theme-d3");
    expect(html).toContain('class="editor-shell"');
    expect(html).toContain('class="editor-scroll"');
  });

  it("expands blog instances under Articles and marks the active one", () => {
    const html = editorChrome(
      { ok: true, username: "alice", createdAt: "2026-01-01" },
      "<h1>Hall</h1>",
      true,
      "articles",
      {
        blogs: [
          { id: "hall", title: "Hall" },
          { id: "news", title: "News" },
        ],
        articlesBlog: "hall",
      },
    );
    expect(html).toContain('aria-label="Blogs"');
    expect(html).toContain('href="#/articles/hall" aria-current="page"');
    expect(html).toContain('href="#/articles/news"');
    expect(html).toContain("editor-nav-child-current");
    expect(html).not.toContain('href="#/articles" aria-current="page"');
    expect(html).toContain('class="w3-bar-item w3-button w3-white" href="#/articles"');
  });

  it("keeps Blogs under Records", () => {
    const html = editorChrome(
      { ok: true, username: "alice", createdAt: "2026-01-01" },
      "<h1>Blogs</h1>",
      true,
      "records",
      { recordsKind: "blogs" },
    );
    expect(html).toContain('href="#/records/blogs" aria-current="page"');
    expect(html).toContain('aria-label="Record types"');
  });

  it("marks the active Records child in the sidebar", () => {
    const html = editorChrome(
      { ok: true, username: "alice", createdAt: "2026-01-01" },
      "<h1>Records</h1>",
      true,
      "records",
      { recordsKind: "layouts" },
    );
    expect(html).toContain('href="#/records/layouts" aria-current="page"');
    expect(html).toContain("editor-nav-child-current");
    expect(html).not.toContain('href="#/records" aria-current="page"');
    expect(html).toContain('class="w3-bar-item w3-button w3-white" href="#/records"');
  });

  it("marks Maintenance and expands report children", () => {
    const html = editorChrome(
      { ok: true, username: "alice", createdAt: "2026-01-01" },
      "<h1>Maintenance</h1>",
      true,
      "maintenance",
      { maintenanceTab: "broken" },
    );
    expect(html).toContain('href="#/maintenance/broken" aria-current="page"');
    expect(html).toContain('aria-label="Maintenance reports"');
    expect(html).not.toContain('href="#/maintenance" aria-current="page"');
    const styles = html.indexOf('href="#/styles"');
    const users = html.indexOf('href="#/users"');
    const maintenance = html.indexOf('href="#/maintenance"');
    expect(styles).toBeLessThan(users);
    expect(users).toBeLessThan(maintenance);
  });

  it("announces the main heading after navigation without focusing it", () => {
    document.body.innerHTML = editorChrome(
      { ok: true, username: "alice", createdAt: "2026-01-01" },
      "<h1>Library</h1>",
    );
    announceRoute(document);
    const heading = document.querySelector("h1");
    expect(document.activeElement).not.toBe(heading);
    expect(heading?.hasAttribute("tabindex")).toBe(false);
    expect(document.querySelector("#route-status")?.textContent).toBe("Library");
    expect(document.title).toBe("Library · Tessera editor");
  });

  it("keeps login errors escaped", () => {
    expect(loginView("<Nope>", "a&b")).toContain("&lt;Nope&gt;");
    expect(loginView("<Nope>", "a&b")).toContain('value="a&amp;b"');
  });
});
