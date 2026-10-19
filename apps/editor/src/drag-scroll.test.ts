import { Window } from "happy-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { startDragScroll } from "./drag-scroll.js";

const dom = new Window();

beforeAll(() => {
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.document,
    HTMLElement: dom.HTMLElement,
    Element: dom.Element,
    requestAnimationFrame: (cb: FrameRequestCallback) => dom.window.requestAnimationFrame(cb),
    cancelAnimationFrame: (id: number) => dom.window.cancelAnimationFrame(id),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  dom.document.body.innerHTML = "";
});

function mountScroller(height = 200, scrollHeight = 800): HTMLElement {
  dom.document.body.innerHTML = `<div class="editor-scroll"><form><div data-canvas></div></form></div>`;
  const scroller = dom.document.querySelector(".editor-scroll");
  if (!(scroller instanceof dom.HTMLElement)) throw new Error("scroller");
  Object.defineProperty(scroller, "scrollHeight", { value: scrollHeight, configurable: true });
  Object.defineProperty(scroller, "clientHeight", { value: height, configurable: true });
  scroller.getBoundingClientRect = () =>
    ({
      top: 100,
      bottom: 100 + height,
      left: 0,
      right: 400,
      width: 400,
      height,
      x: 0,
      y: 100,
      toJSON() {
        return {};
      },
    }) as DOMRect;
  return scroller;
}

describe("drag scroll", () => {
  it("scrolls down when the pointer is near the bottom edge", async () => {
    const scroller = mountScroller();
    const form = scroller.querySelector("form");
    if (!form) throw new Error("form");
    const scroll = startDragScroll(form);
    scroll.update(280);
    await new Promise((resolve) => dom.window.requestAnimationFrame(() => resolve(undefined)));
    expect(scroller.scrollTop).toBeGreaterThan(0);
    scroll.stop();
  });

  it("scrolls up when the pointer is near the top edge", async () => {
    const scroller = mountScroller();
    scroller.scrollTop = 120;
    const form = scroller.querySelector("form");
    if (!form) throw new Error("form");
    const scroll = startDragScroll(form);
    scroll.update(110);
    await new Promise((resolve) => dom.window.requestAnimationFrame(() => resolve(undefined)));
    expect(scroller.scrollTop).toBeLessThan(120);
    scroll.stop();
  });

  it("stops scrolling once the pointer leaves the edge band", async () => {
    const scroller = mountScroller();
    const form = scroller.querySelector("form");
    if (!form) throw new Error("form");
    const scroll = startDragScroll(form);
    scroll.update(280);
    await new Promise((resolve) => dom.window.requestAnimationFrame(() => resolve(undefined)));
    const afterEdge = scroller.scrollTop;
    expect(afterEdge).toBeGreaterThan(0);
    scroll.update(200);
    const mid = scroller.scrollTop;
    await new Promise((resolve) => dom.window.requestAnimationFrame(() => resolve(undefined)));
    expect(scroller.scrollTop).toBe(mid);
    scroll.stop();
  });
});
