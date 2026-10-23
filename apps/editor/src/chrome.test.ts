// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import { ADMIN_MENU, SETUP_MENU } from "./editor-sidebar-menu.js";
import { announceRoute, editorChrome, loginView } from "./chrome.js";

describe("editor chrome", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("lists Setup and Admin items in menu config order", () => {
    const html = editorChrome(
      { ok: true, username: "alice", createdAt: "2026-01-01" },
      "<h1>Pages</h1>",
      false,
      "pages",
    );
    let lastSetup = 0;
    for (const item of SETUP_MENU.items) {
      const at = html.indexOf(`href="${item.href}"`);
      expect(at).toBeGreaterThan(-1);
      expect(at).toBeGreaterThan(lastSetup);
      lastSetup = at;
    }
    let lastAdmin = html.indexOf('aria-label="Admin"');
    expect(lastAdmin).toBeGreaterThan(-1);
    for (const item of ADMIN_MENU.items) {
      const at = html.indexOf(`href="${item.href}"`);
      expect(at).toBeGreaterThan(-1);
      expect(at).toBeGreaterThan(lastAdmin);
      lastAdmin = at;
    }
  });

  it("lists Navigation and Pages before the setup block in the sidebar", () => {
    const html = editorChrome(
      { ok: true, username: "alice", createdAt: "2026-01-01" },
      "<h1>Pages</h1>",
      false,
      "pages",
    );
    const navigation = html.indexOf('href="#/navigation"');
    const pages = html.indexOf('href="#/pages"');
    const setup = html.indexOf('aria-label="Setup"');
    expect(navigation).toBeLessThan(pages);
    expect(pages).toBeLessThan(setup);
  });

  it("marks the current section and escapes the account name", () => {
    const html = editorChrome(
      { ok: true, username: "<Alice>", createdAt: "2026-01-01" },
      "<h1>Records</h1>",
      false,
      "records",
    );
    expect(html).toContain('href="#/records/site"');
    expect(html).toContain('aria-label="Setup"');
    expect(html).toContain("&lt;Alice&gt;");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('class="editor-sidebar w3-theme"');
    expect(html).toContain("editor-nav-brand w3-theme-d3");
    expect(html).toContain('class="editor-shell"');
    expect(html).toContain('class="editor-scroll"');
    expect(html).toContain('class="editor-sidebar-version"');
    expect(html).not.toContain("editor-footer");
    expect(html).not.toContain('data-action="logout"');
  });

  it("hides Articles when no blogs are defined", () => {
    const html = editorChrome(
      { ok: true, username: "alice", createdAt: "2026-01-01" },
      "<h1>Pages</h1>",
      false,
      "pages",
      { blogs: [] },
    );
    expect(html).not.toContain('href="#/articles"');
  });

  it("hides Data when no datasets are defined", () => {
    const html = editorChrome(
      { ok: true, username: "alice", createdAt: "2026-01-01" },
      "<h1>Pages</h1>",
      false,
      "pages",
      { datasets: [] },
    );
    expect(html).not.toContain('href="#/data"');
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

  it("expands datasets under Data and marks the active one", () => {
    const html = editorChrome(
      { ok: true, username: "alice", createdAt: "2026-01-01" },
      "<h1>Products</h1>",
      true,
      "data",
      {
        datasets: [
          { id: "events", title: "Events" },
          { id: "products", title: "Products" },
        ],
        activeDataset: "products",
      },
    );
    expect(html).toContain('aria-label="Datasets"');
    expect(html).toContain('href="#/data/products" aria-current="page"');
    expect(html).toContain('href="#/data/events"');
    expect(html).not.toContain('href="#/data" aria-current="page"');
    expect(html).toContain('class="w3-bar-item w3-button w3-white" href="#/data"');
  });

  it("lists Datasets under Setup", () => {
    const html = editorChrome(
      { ok: true, username: "alice", createdAt: "2026-01-01" },
      "<h1>Datasets</h1>",
      true,
      "records",
      { recordsKind: "datasets" },
    );
    expect(html).toContain('href="#/records/datasets" aria-current="page"');
  });

  it("keeps Blogs under Setup", () => {
    const html = editorChrome(
      { ok: true, username: "alice", createdAt: "2026-01-01" },
      "<h1>Blogs</h1>",
      true,
      "records",
      { recordsKind: "blogs" },
    );
    expect(html).toContain('href="#/records/blogs" aria-current="page"');
    expect(html).toContain('aria-label="Setup"');
  });

  it("marks the active setup child in the sidebar", () => {
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
  });

  it("places Setup before Admin in the sidebar", () => {
    const html = editorChrome(
      { ok: true, username: "alice", createdAt: "2026-01-01" },
      "<h1>Pages</h1>",
      false,
      "pages",
    );
    expect(html.indexOf('aria-label="Setup"')).toBeLessThan(html.indexOf('aria-label="Admin"'));
  });

  it("groups admin pages and expands maintenance report children", () => {
    const html = editorChrome(
      { ok: true, username: "alice", createdAt: "2026-01-01" },
      "<h1>Maintenance</h1>",
      true,
      "maintenance",
      { maintenanceTab: "broken" },
    );
    expect(html).toContain('aria-label="Admin"');
    expect(html).toContain('href="#/maintenance/broken" aria-current="page"');
    expect(html).toContain('aria-label="Maintenance reports"');
    expect(html).not.toContain('href="#/maintenance" aria-current="page"');
    const styles = html.indexOf('href="#/styles"');
    const users = html.indexOf('href="#/users"');
    expect(styles).toBeLessThan(users);
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

  it("hides admin nav items for limited editors but keeps Navigation", () => {
    const html = editorChrome(
      { ok: true, username: "editor", createdAt: "2026-01-01", restrictAccessLevel: "editor" },
      "<h1>Pages</h1>",
      false,
      "pages",
    );
    expect(html).not.toContain('href="#/records"');
    expect(html).not.toContain('href="#/styles"');
    expect(html).not.toContain('href="#/users"');
    expect(html).not.toContain('href="#/backups"');
    expect(html).not.toContain('href="#/maintenance"');
    expect(html).not.toContain('aria-label="Admin"');
    expect(html).not.toContain('href="#/records/runtimeModules"');
    expect(html).toContain('href="#/navigation"');
    expect(html).toContain('href="#/pages"');
  });

  it("lists Runtime modules under Setup for admins", () => {
    const html = editorChrome(
      { ok: true, username: "alice", createdAt: "2026-01-01" },
      "<h1>Runtime modules</h1>",
      true,
      "records",
      { recordsKind: "runtimeModules" },
    );
    expect(html).not.toContain('href="#/runtime-modules"');
    expect(html).toContain('href="#/records/runtimeModules" aria-current="page"');
  });

  it("keeps login errors escaped", () => {
    expect(loginView("<Nope>", "a&b")).toContain("&lt;Nope&gt;");
    expect(loginView("<Nope>", "a&b")).toContain('value="a&amp;b"');
  });
});
