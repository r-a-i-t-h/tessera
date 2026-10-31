/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it } from "vitest";
import { isEntityOpenShortcut, triggerOpenAction } from "./open-key.js";
import { entityOpenerHtml, bindEntityOpener } from "./entity-opener.js";

describe("isEntityOpenShortcut", () => {
  it("matches Cmd/Ctrl+O and Cmd/Ctrl+Shift+O", () => {
    expect(
      isEntityOpenShortcut(new KeyboardEvent("keydown", { code: "KeyO", metaKey: true, shiftKey: true })),
    ).toBe(true);
    expect(
      isEntityOpenShortcut(new KeyboardEvent("keydown", { code: "KeyO", metaKey: true })),
    ).toBe(true);
    expect(
      isEntityOpenShortcut(new KeyboardEvent("keydown", { code: "KeyO", ctrlKey: true })),
    ).toBe(true);
    expect(isEntityOpenShortcut(new KeyboardEvent("keydown", { code: "KeyN", metaKey: true }))).toBe(false);
  });
});

describe("triggerOpenAction", () => {
  it("opens the entity opener when present", () => {
    const root = document.createElement("div");
    root.innerHTML = entityOpenerHtml("Home", "home", [
      { id: "about", label: "About", hash: "#/content/about", filterText: "about" },
    ]);
    bindEntityOpener(root);

    expect(triggerOpenAction(root)).toBe(true);
    expect(root.querySelector(".editor-entity-opener-panel")?.hidden).toBe(false);
  });

  it("returns false when no entity opener is on the page", () => {
    const root = document.createElement("div");
    root.innerHTML = `<h1 class="w3-large">Only title</h1>`;
    expect(triggerOpenAction(root)).toBe(false);
  });
});
