import { describe, expect, it, beforeEach } from "vitest";
import { makeFixtureDoc } from "../../renderer/src/__tests__/fixtures.js";
import { isEditorPreviewHost, updatePreviewDiagnostics } from "./preview-diagnostics.js";

describe("preview diagnostics panel", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.head.querySelector("#tessera-preview-diagnostics-style")?.remove();
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
});
