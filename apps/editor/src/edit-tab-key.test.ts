/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it, vi } from "vitest";
import {
  editTabDirectionFromEvent,
  isEditTabShortcut,
  triggerEditTabAdjacent,
} from "./edit-tab-key.js";

describe("isEditTabShortcut", () => {
  it("matches unmodified brackets outside typing targets", () => {
    expect(isEditTabShortcut(new KeyboardEvent("keydown", { code: "BracketRight", bubbles: true }))).toBe(
      true,
    );
    expect(
      isEditTabShortcut(
        new KeyboardEvent("keydown", { code: "BracketRight", metaKey: true, shiftKey: true }),
      ),
    ).toBe(false);
  });

  it("ignores brackets while typing", () => {
    const input = document.createElement("input");
    document.body.append(input);
    const event = new KeyboardEvent("keydown", { code: "BracketRight", bubbles: true });
    Object.defineProperty(event, "target", { value: input });
    expect(isEditTabShortcut(event)).toBe(false);
    input.remove();
  });
});

describe("editTabDirectionFromEvent", () => {
  it("maps bracket codes to direction", () => {
    expect(editTabDirectionFromEvent(new KeyboardEvent("keydown", { code: "BracketRight" }))).toBe(
      "next",
    );
    expect(editTabDirectionFromEvent(new KeyboardEvent("keydown", { code: "BracketLeft" }))).toBe(
      "prev",
    );
  });
});

function tabStrip(label: string, tabs: string): string {
  return `<div class="editor-tab-strip"><div class="editor-tabs" role="tablist" aria-label="${label}">${tabs}</div></div>`;
}

describe("triggerEditTabAdjacent", () => {
  it("clicks the next tab after the active one", () => {
    const root = document.createElement("div");
    root.innerHTML = tabStrip(
      "Editing mode",
      `<button type="button" role="tab" class="is-active" data-mode="fields" aria-selected="true">Page</button>
      <button type="button" role="tab" data-mode="compose">Compose</button>`,
    );
    const onCompose = vi.fn();
    root.querySelector("[data-mode=compose]")?.addEventListener("click", onCompose);
    expect(triggerEditTabAdjacent(root, "next")).toBe(true);
    expect(onCompose).toHaveBeenCalledTimes(1);
  });

  it("switches dataset editor tabs", () => {
    const root = document.createElement("div");
    root.innerHTML = tabStrip(
      "Dataset editor",
      `<button type="button" role="tab" class="is-active" data-dataset-tab="dataset" aria-selected="true">Dataset</button>
      <button type="button" role="tab" data-dataset-tab="schema">Schema</button>
      <button type="button" role="tab" data-dataset-tab="raw">Raw file</button>`,
    );
    const onSchema = vi.fn();
    root.querySelector("[data-dataset-tab=schema]")?.addEventListener("click", onSchema);
    expect(triggerEditTabAdjacent(root, "next")).toBe(true);
    expect(onSchema).toHaveBeenCalledTimes(1);
  });

  it("does not move past the last tab", () => {
    const root = document.createElement("div");
    root.innerHTML = tabStrip(
      "Editing mode",
      `<button type="button" role="tab" data-mode="fields">Page</button>
      <button type="button" role="tab" class="is-active" data-mode="raw" aria-selected="true">Raw</button>`,
    );
    expect(triggerEditTabAdjacent(root, "next")).toBe(false);
  });

  it("ignores inline tab strips", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div class="editor-tab-strip editor-tab-strip--inline"><div class="editor-tabs" role="tablist" aria-label="Library">
      <button type="button" role="tab" class="is-active" aria-selected="true">Pages</button>
      <button type="button" role="tab">Assets</button>
    </div></div>`;
    const onAssets = vi.fn();
    root.querySelectorAll("button")[1]?.addEventListener("click", onAssets);
    expect(triggerEditTabAdjacent(root, "next")).toBe(false);
    expect(onAssets).not.toHaveBeenCalled();
  });
});
