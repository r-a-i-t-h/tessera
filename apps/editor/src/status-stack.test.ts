// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { pushStatusMessage, statusStack } from "./status-stack.js";

function editorRoot(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <div class="editor-body">
      <div id="editor-status-stack" class="editor-status-stack" hidden></div>
      <div class="editor-scroll"></div>
    </div>`;
  return root;
}

describe("status stack", () => {
  it("appends progress and error messages without replacing earlier ones", () => {
    const root = editorRoot();
    const rendering = pushStatusMessage(root, "progress", "Rendering the whole site…");
    pushStatusMessage(root, "error", "Render failed.");

    const host = statusStack(root);
    expect(host.hidden).toBe(false);
    expect(host.children).toHaveLength(2);
    expect(host.children[0]).toBe(rendering.el);
    expect(host.children[1]?.querySelector(".editor-render-status-body")?.textContent).toBe(
      "Render failed.",
    );
  });

  it("dismisses a banner when its close control is used", () => {
    const root = editorRoot();
    pushStatusMessage(root, "error", "First failure.");
    pushStatusMessage(root, "error", "Second failure.");

    const host = statusStack(root);
    expect(host.children).toHaveLength(2);
    host.children[0]?.querySelector<HTMLButtonElement>(".editor-render-status-dismiss")?.click();
    expect(host.children).toHaveLength(1);
    expect(host.querySelector(".editor-render-status-body")?.textContent).toBe("Second failure.");
  });

  it("hides the host when the last message is removed", () => {
    const root = editorRoot();
    const progress = pushStatusMessage(root, "progress", "Working…");
    progress.remove();
    expect(statusStack(root).hidden).toBe(true);
  });
});
