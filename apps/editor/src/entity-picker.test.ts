/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it, vi } from "vitest";
import { wirePickerList } from "./entity-picker.js";

describe("wirePickerList", () => {
  it("filters items by filterText", () => {
    vi.useFakeTimers();
    const input = document.createElement("input");
    const list = document.createElement("ul");
    wirePickerList({
      input,
      list,
      listId: "test-list",
      getItems: () => [
        { label: "Alpha", filterText: "alpha", category: "Page" },
        { label: "Beta", filterText: "beta", category: "Page" },
      ],
      onSelect: () => {},
      showCategory: true,
    });
    input.value = "bet";
    input.dispatchEvent(new Event("input"));
    vi.advanceTimersByTime(150);
    vi.useRealTimers();
    expect(list.querySelectorAll('[role="option"]').length).toBe(1);
    expect(list.textContent).toContain("Beta");
    expect(list.innerHTML).toContain("editor-picker-category");
  });
});
