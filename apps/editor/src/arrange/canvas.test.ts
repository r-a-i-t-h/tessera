import { Window } from "happy-dom";
import { beforeAll, describe, expect, it } from "vitest";
import { arrangeMarkup, mountArrange } from "./canvas.js";
import { newPageLayout } from "./tree.js";

const dom = new Window();

beforeAll(() => {
  Object.assign(globalThis, {
    window: dom,
    document: dom.document,
    HTMLElement: dom.HTMLElement,
    HTMLInputElement: dom.HTMLInputElement,
    HTMLTextAreaElement: dom.HTMLTextAreaElement,
    HTMLSelectElement: dom.HTMLSelectElement,
    Node: dom.Node,
    Element: dom.Element,
  });
});

describe("arrange drag ghost", () => {
  it("shows the palette label and the node name", () => {
    const { root } = newPageLayout("home");
    const info = { layoutId: "home", master: false, fallback: false, typeIds: [] as string[] };
    dom.document.body.innerHTML = `<form>${arrangeMarkup(root, info)}</form>`;
    const form = dom.document.querySelector("form");
    if (!(form instanceof dom.HTMLFormElement)) throw new Error("form");
    mountArrange(form, root, info);

    const palette = form.querySelector("[data-palette=zone]");
    const grip = form.querySelector('[data-drag-path="1"]');
    if (!palette || !grip) throw new Error("drag sources");
    expect(dragGhost(palette).textContent).toBe("Zone");
    expect(dragGhost(grip).textContent).toBe("main · zone");
  });
});

function dragGhost(target: Element): Element {
  const images: Element[] = [];
  const transfer = {
    effectAllowed: "",
    setData() {},
    setDragImage(image: Element) {
      images.push(image);
    },
  };
  const event = new dom.Event("dragstart", { bubbles: true });
  Object.defineProperty(event, "dataTransfer", { value: transfer });
  target.dispatchEvent(event);
  const ghost = images[0];
  if (!ghost) throw new Error("drag image");
  return ghost;
}
