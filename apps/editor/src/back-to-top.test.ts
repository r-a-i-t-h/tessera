/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it } from "vitest";
import { BACK_TO_TOP_SHOW_PX, bindBackToTop } from "./back-to-top.js";

describe("bindBackToTop", () => {
  it("shows after scrolling and returns to the top on click", () => {
    const root = document.createElement("div");
    root.innerHTML = `<div class="editor-scroll" style="height: 100px; overflow: auto">
        <div style="height: 400px"></div>
      </div>
      <button type="button" class="editor-back-to-top">Up</button>`;
    const scroller = root.querySelector(".editor-scroll") as HTMLElement;
    Object.defineProperty(scroller, "scrollTop", { writable: true, value: 0 });
    bindBackToTop(root);
    const button = root.querySelector(".editor-back-to-top")!;
    expect(button.classList.contains("editor-back-to-top--visible")).toBe(false);

    scroller.scrollTop = BACK_TO_TOP_SHOW_PX + 1;
    scroller.dispatchEvent(new Event("scroll"));
    expect(button.classList.contains("editor-back-to-top--visible")).toBe(true);

    scroller.scrollTo = (options) => {
      scroller.scrollTop = typeof options === "object" ? (options.top ?? 0) : 0;
    };
    button.dispatchEvent(new Event("click"));
    expect(scroller.scrollTop).toBe(0);
  });
});
