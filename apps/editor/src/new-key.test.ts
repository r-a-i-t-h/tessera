/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it, vi } from "vitest";
import { triggerNewAction } from "./new-key.js";

describe("triggerNewAction", () => {
  it("clicks the first visible New control", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" data-action="new-page" hidden>New page</button>
      <button type="button" data-action="new-template">New template</button>`;
    const onNew = vi.fn();
    root.querySelector("[data-action=new-template]")?.addEventListener("click", onNew);

    expect(triggerNewAction(root)).toBe(true);
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("returns false when no New control is available", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p>No actions here</p>`;
    expect(triggerNewAction(root)).toBe(false);
  });

  it("triggers New record on dataset grids", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" data-dataset-add>New record</button>`;
    const onAdd = vi.fn();
    root.querySelector("[data-dataset-add]")?.addEventListener("click", onAdd);

    expect(triggerNewAction(root)).toBe(true);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
