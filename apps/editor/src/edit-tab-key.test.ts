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

describe("triggerEditTabAdjacent", () => {
  it("clicks the next tab after the active one", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div class="editor-tabs" role="tablist" aria-label="Editing mode">
      <button type="button" class="is-active" data-mode="fields" aria-selected="true">Page</button>
      <button type="button" data-mode="compose">Compose</button>
    </div>`;
    const onCompose = vi.fn();
    root.querySelector("[data-mode=compose]")?.addEventListener("click", onCompose);
    expect(triggerEditTabAdjacent(root, "next")).toBe(true);
    expect(onCompose).toHaveBeenCalledTimes(1);
  });

  it("does not move past the last tab", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div class="editor-tabs" role="tablist" aria-label="Editing mode">
      <button type="button" data-mode="fields">Page</button>
      <button type="button" class="is-active" data-mode="raw" aria-selected="true">Raw</button>
    </div>`;
    expect(triggerEditTabAdjacent(root, "next")).toBe(false);
  });
});
