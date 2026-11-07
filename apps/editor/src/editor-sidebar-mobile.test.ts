// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { closeEditorSidebar, wireEditorSidebarMobile } from "./editor-sidebar-mobile.js";

function mountShell(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `<div class="editor-shell">
    <aside id="editor-sidebar" class="editor-sidebar"></aside>
    <div class="editor-sidebar-overlay" data-action="close-editor-sidebar" hidden aria-hidden="true"></div>
    <div class="editor-body">
      <button type="button" data-action="toggle-editor-sidebar" aria-expanded="false" aria-label="Open menu">Menu</button>
    </div>
  </div>`;
  document.body.appendChild(root);
  return root;
}

describe("editor-sidebar-mobile", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("toggles open state when phone layout matches", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 600px)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const root = mountShell();
    wireEditorSidebarMobile(root);
    const shell = root.querySelector(".editor-shell")!;
    const toggle = root.querySelector<HTMLButtonElement>('[data-action="toggle-editor-sidebar"]')!;

    toggle.click();
    expect(shell.classList.contains("is-editor-sidebar-open")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe("Close menu");

    toggle.click();
    expect(shell.classList.contains("is-editor-sidebar-open")).toBe(false);
  });

  it("closes when a hash link inside the sidebar is clicked", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 600px)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const root = mountShell();
    const sidebar = root.querySelector("#editor-sidebar")!;
    sidebar.innerHTML = '<a href="#/pages">Pages</a>';
    wireEditorSidebarMobile(root);
    const shell = root.querySelector(".editor-shell")!;
    root.querySelector<HTMLButtonElement>('[data-action="toggle-editor-sidebar"]')!.click();
    sidebar.querySelector("a")!.click();
    expect(shell.classList.contains("is-editor-sidebar-open")).toBe(false);
  });

  it("closeEditorSidebar returns false when drawer is closed", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 600px)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const root = mountShell();
    expect(closeEditorSidebar(root)).toBe(false);
  });
});
