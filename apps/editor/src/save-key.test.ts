/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it, vi } from "vitest";
import { editingForm, isEditorSaveShortcut, triggerEditorSave } from "./save-key.js";

describe("isEditorSaveShortcut", () => {
  it("matches Cmd/Ctrl+S only", () => {
    expect(
      isEditorSaveShortcut(new KeyboardEvent("keydown", { code: "KeyS", metaKey: true })),
    ).toBe(true);
    expect(
      isEditorSaveShortcut(new KeyboardEvent("keydown", { code: "KeyS", ctrlKey: true })),
    ).toBe(true);
    expect(
      isEditorSaveShortcut(new KeyboardEvent("keydown", { code: "KeyS", metaKey: true, shiftKey: true })),
    ).toBe(false);
    expect(
      isEditorSaveShortcut(new KeyboardEvent("keydown", { code: "KeyZ", metaKey: true })),
    ).toBe(false);
  });
});

describe("editingForm", () => {
  it("accepts record and style forms", () => {
    const record = document.createElement("form");
    record.id = "record-form";
    expect(editingForm(record)).toBe(record);
    const other = document.createElement("form");
    other.id = "search";
    expect(editingForm(other)).toBeNull();
  });
});

describe("triggerEditorSave", () => {
  it("submits the record form when a compose field is focused", () => {
    const root = document.createElement("div");
    root.innerHTML = `<form id="record-form"><div contenteditable="true" class="editor-text-body"></div></form>`;
    const form = root.querySelector<HTMLFormElement>("#record-form");
    const field = root.querySelector<HTMLElement>(".editor-text-body");
    if (!form || !field) throw new Error("fixture");
    field.focus();
    const submit = vi.fn();
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submit();
    });
    const event = new KeyboardEvent("keydown", {
      code: "KeyS",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    expect(triggerEditorSave(root, event)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(submit).toHaveBeenCalledOnce();
  });

  it("clicks Save grid when grid edit is active", () => {
    const root = document.createElement("div");
    const onSave = vi.fn();
    root.innerHTML = `<button type="button" data-dataset-save-grid>Save grid</button>`;
    root.querySelector("[data-dataset-save-grid]")?.addEventListener("click", onSave);
    document.body.append(root);
    const event = new KeyboardEvent("keydown", {
      code: "KeyS",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    expect(triggerEditorSave(root, event)).toBe(true);
    expect(onSave).toHaveBeenCalledOnce();
    root.remove();
  });
});
