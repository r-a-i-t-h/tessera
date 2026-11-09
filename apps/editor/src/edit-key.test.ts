/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it, vi } from "vitest";
import { isEditShortcut, triggerEditFocus } from "./edit-key.js";

describe("isEditShortcut", () => {
  it("matches Mod+E outside typing targets", () => {
    expect(isEditShortcut(new KeyboardEvent("keydown", { code: "KeyE", metaKey: true }))).toBe(true);
    const input = document.createElement("input");
    const event = new KeyboardEvent("keydown", { code: "KeyE", metaKey: true, bubbles: true });
    Object.defineProperty(event, "target", { value: input });
    expect(isEditShortcut(event)).toBe(false);
  });
});

describe("triggerEditFocus", () => {
  it("enters grid edit and focuses a cell", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const root = document.createElement("div");
    document.body.append(root);
    root.innerHTML = `<button type="button" data-dataset-edit-mode>Edit grid</button>`;
    const onEdit = vi.fn(() => {
      root.innerHTML = `<input data-grid-edit="1" data-grid-field="title" class="w3-input" />`;
    });
    root.querySelector("[data-dataset-edit-mode]")?.addEventListener("click", onEdit);
    expect(triggerEditFocus(root)).toBe(true);
    expect(onEdit).toHaveBeenCalled();
    expect(document.activeElement?.hasAttribute("data-grid-edit")).toBe(true);
    root.remove();
    vi.unstubAllGlobals();
  });

  it("focuses the first field in a record form", () => {
    const root = document.createElement("div");
    document.body.append(root);
    root.innerHTML = `<form id="record-form"><input id="title" class="w3-input" /><textarea id="raw"></textarea></form>`;
    expect(triggerEditFocus(root)).toBe(true);
    expect(document.activeElement?.id).toBe("title");
    root.remove();
  });
});
