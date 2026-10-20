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
  it("appends messages instead of replacing earlier ones", () => {
    const root = editorRoot();
    pushStatusMessage(root, "success", "Rendered 3 pages.");
    const publishing = pushStatusMessage(root, "progress", "Publishing…");
    pushStatusMessage(root, "success", "Published 3 files.");

    const host = statusStack(root);
    expect(host.hidden).toBe(false);
    expect(host.children).toHaveLength(3);
    expect(host.children[0]?.textContent).toBe("Rendered 3 pages.");
    expect(host.children[1]).toBe(publishing.el);
    expect(host.children[2]?.textContent).toBe("Published 3 files.");
  });

  it("hides the host when the last message is removed", () => {
    const root = editorRoot();
    const progress = pushStatusMessage(root, "progress", "Working…");
    progress.remove();
    expect(statusStack(root).hidden).toBe(true);
  });
});
