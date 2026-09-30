import { Window } from "happy-dom";
import { beforeAll, describe, expect, it } from "vitest";
import { mountComposeCanvases, readComposeHtml } from "./canvas.js";

const dom = new Window();

beforeAll(() => {
  Object.assign(globalThis, {
    window: dom,
    document: dom.document,
    HTMLElement: dom.HTMLElement,
    HTMLInputElement: dom.HTMLInputElement,
    HTMLSelectElement: dom.HTMLSelectElement,
    Node: dom.Node,
    Element: dom.Element,
    DOMParser: dom.DOMParser,
  });
});

describe("compose palette", () => {
  it("paints a pasted note, subpages, a YouTube id, and a gallery folder", () => {
    dom.document.body.innerHTML = `<form>
      <button type="button" data-palette="pasted">Pasted note</button>
      <button type="button" data-palette="subpages">Subpages</button>
      <button type="button" data-palette="youtube">YouTube</button>
      <button type="button" data-palette="gallery">Gallery</button>
      <div data-canvas data-zone="main"></div>
    </form>`;
    const form = dom.document.querySelector("form");
    if (!(form instanceof dom.HTMLFormElement)) throw new Error("form");
    mountComposeCanvases(form, {
      bindings: [],
      folders: [{ id: "lambs", title: "Lambs" }],
      htmlByZone: { main: "" },
    });

    for (const kind of ["pasted", "subpages", "youtube", "gallery"]) {
      form.querySelector(`[data-palette="${kind}"]`)?.dispatchEvent(new dom.MouseEvent("click", { bubbles: true }));
    }

    const sheet = form.querySelector<HTMLElement>(".tessera-pasted-sheet [contenteditable]");
    if (!sheet) throw new Error("sheet");
    sheet.innerHTML = "<p>Written here.</p><p>And more.</p>";
    sheet.dispatchEvent(new dom.Event("input", { bubbles: true }));

    const video = form.querySelector<HTMLInputElement>("[data-field=video]");
    if (!video) throw new Error("video");
    video.value = "https://youtu.be/QvAdmE0vPW0";
    video.dispatchEvent(new dom.Event("change", { bubbles: true }));

    const folder = form.querySelector<HTMLSelectElement>("[data-field=folder]");
    if (!folder) throw new Error("folder");
    folder.value = "lambs";
    folder.dispatchEvent(new dom.Event("change", { bubbles: true }));

    const html = readComposeHtml(form).main ?? "";
    expect(html).toContain("tessera-pasted-sheet");
    expect(html).toContain("<p>Written here.</p>");
    expect(html).toContain("<p>And more.</p>");
    expect(html).toContain('data-tessera="subpages"');
    expect(html).toContain("https://www.youtube-nocookie.com/embed/QvAdmE0vPW0");
    expect(html).toContain('data-folder="lambs"');
    expect(html).toContain('data-mode="grid"');
  });
});
