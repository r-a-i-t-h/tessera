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
    expect(html).toContain("&lt;Alice&gt;");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('class="editor-bar w3-bar w3-theme"');
    expect(html).toContain('class="editor-scroll"');
  });

  it("marks Maintenance in the top bar", () => {
    const html = editorChrome(
      { ok: true, username: "alice", createdAt: "2026-01-01" },
      "<h1>Maintenance</h1>",
      true,
      "maintenance",
    );
    expect(html).toContain('href="#/maintenance" aria-current="page"');
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
