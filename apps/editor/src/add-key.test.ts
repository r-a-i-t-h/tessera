/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it, vi } from "vitest";
import { isAddShortcut, triggerAddAction } from "./add-key.js";

describe("isAddShortcut", () => {
  it("matches Mod+A only when not in a typing target", () => {
    expect(
      isAddShortcut(new KeyboardEvent("keydown", { code: "KeyA", metaKey: true, bubbles: true })),
    ).toBe(true);
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    const inField = new KeyboardEvent("keydown", { code: "KeyA", metaKey: true, bubbles: true });
    Object.defineProperty(inField, "target", { value: input });
    expect(isAddShortcut(inField)).toBe(false);
    input.remove();
  });

  it("rejects Shift+Mod+A", () => {
    expect(
      isAddShortcut(new KeyboardEvent("keydown", { code: "KeyA", metaKey: true, shiftKey: true })),
    ).toBe(false);
  });
});

describe("triggerAddAction", () => {
  it("clicks the first visible Add control", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" data-action="add-page" hidden>Add page</button>
      <button type="button" data-action="add-template">Add template</button>`;
    const onAdd = vi.fn();
    root.querySelector("[data-action=add-template]")?.addEventListener("click", onAdd);

    expect(triggerAddAction(root)).toBe(true);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("returns false when no Add control is available", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p>No actions here</p>`;
    expect(triggerAddAction(root)).toBe(false);
  });

  it("triggers Add record on dataset grids", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" data-dataset-add>Add record</button>`;
    const onAdd = vi.fn();
    root.querySelector("[data-dataset-add]")?.addEventListener("click", onAdd);

    expect(triggerAddAction(root)).toBe(true);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("triggers Add field on the dataset schema tab", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" data-action="add-field" data-schema-action="add">Add field</button>`;
    const onAdd = vi.fn();
    root.querySelector("[data-action=add-field]")?.addEventListener("click", onAdd);

    expect(triggerAddAction(root)).toBe(true);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
