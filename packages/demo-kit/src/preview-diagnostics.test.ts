import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeFixtureDoc } from "../../renderer/src/__tests__/fixtures.js";
import { isEditorPreviewHost, updatePreviewDiagnostics } from "./preview-diagnostics.js";

const storage = new Map<string, string>();

function stubStorage(): void {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  });
}

describe("preview diagnostics panel", () => {
  beforeEach(() => {
    storage.clear();
    stubStorage();
    document.body.innerHTML = "";
    document.head.querySelector("#tessera-preview-diagnostics-style")?.remove();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects preview pathname", () => {
    expect(isEditorPreviewHost({ pathname: "/preview/" })).toBe(true);
    expect(isEditorPreviewHost({ pathname: "/preview" })).toBe(true);
    expect(isEditorPreviewHost({ pathname: "/foo/preview" })).toBe(true);
    expect(isEditorPreviewHost({ pathname: "/" })).toBe(false);
    expect(isEditorPreviewHost({ pathname: "/about/" })).toBe(false);
  });

  it("does not mount outside preview", () => {
    const doc = makeFixtureDoc();
    updatePreviewDiagnostics("home", doc, { pathname: "/" });
    expect(document.getElementById("tessera-preview-diagnostics")).toBeNull();
  });

  it("restores toggle position from localStorage", () => {
    localStorage.setItem(
      "tessera-preview-diagnostics-offset",
      JSON.stringify({ top: 40, right: 80 }),
    );
    updatePreviewDiagnostics("home", makeFixtureDoc(), { pathname: "/preview/" });
    const root = document.getElementById("tessera-preview-diagnostics");
    expect(root?.style.top).toBe("40px");
    expect(root?.style.right).toBe("80px");
  });

  it("mounts panel with editor links under preview", () => {
    const doc = makeFixtureDoc();
    updatePreviewDiagnostics("home", doc, { pathname: "/preview/" });

    const root = document.getElementById("tessera-preview-diagnostics");
    expect(root).not.toBeNull();

    const body = document.getElementById("tessera-preview-diagnostics-body");
    expect(body?.textContent).toContain("Home");
    const edit = body?.querySelector('a[href="../#/content/home"]');
    expect(edit).not.toBeNull();

    updatePreviewDiagnostics("about", doc, { pathname: "/preview/" });
    expect(body?.textContent).toContain("About");
    expect(body?.querySelector('a[href="../#/content/about"]')).not.toBeNull();
  });

  it("lists page links to and from the current page", () => {
    const base = makeFixtureDoc();
    const doc = {
      ...base,
      pages: [
        {
          id: "home",
          title: "Home",
          zones: {
            main: [
              {
                type: "text" as const,
                html: `<p><a data-tessera-page="about" href="#">About</a> <a data-tessera-page="gone" href="#">Gone</a></p>`,
              },
            ],
          },
        },
        {
          id: "about",
          title: "About",
          zones: {
            main: [{ type: "text" as const, html: "<p>About</p>" }],
          },
        },
      ],
    };

    updatePreviewDiagnostics("home", doc, { pathname: "/preview/" });
    const body = document.getElementById("tessera-preview-diagnostics-body");
    expect(body?.textContent).toContain("Page links");
    expect(body?.textContent).toContain("Linked to");
    expect(body?.textContent).toContain("Linked from");
    expect(body?.querySelector('a[href="#about"]')).not.toBeNull();
    expect(body?.textContent).toContain("missing");

    updatePreviewDiagnostics("about", doc, { pathname: "/preview/" });
    expect(body?.querySelector('a[href="#home"]')).not.toBeNull();
    expect(body?.textContent).toContain("Home");
  });
});
