/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it, vi } from "vitest";
import { bindPickerClicks } from "./picker-bind.js";

describe("bindPickerClicks", () => {
  it("registers at most one click listener per form", () => {
    const form = document.createElement("form");
    form.innerHTML = `<button type="button" data-library="image">Library</button>`;
    const listener = vi.fn((event: Event) => {
      const button = (event.target as HTMLElement).closest("button");
      if (button?.dataset.library === "image") event.preventDefault();
    });

    bindPickerClicks(form, listener);
    bindPickerClicks(form, listener);
    bindPickerClicks(form, listener);

    form.querySelector("button")!.click();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
