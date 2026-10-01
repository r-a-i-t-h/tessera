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

  it("keeps several paragraphs and an optional heading in one text item", () => {
    dom.document.body.innerHTML = `<form>
      <button type="button" data-palette="text">Text</button>
      <div data-canvas data-zone="main"></div>
    </form>`;
    const form = dom.document.querySelector("form");
    if (!(form instanceof dom.HTMLFormElement)) throw new Error("form");
    mountComposeCanvases(form, {
      bindings: [],
      htmlByZone: {
        main: `<h2>Market</h2><p>Opens at nine.</p><p>Closes at one.</p><ul><li>Bread</li></ul><div class="tessera-page-gallery" data-tessera="gallery" data-folder="lambs" data-mode="grid"></div>`,
      },
    });

    expect(form.querySelectorAll("[data-item-id]")).toHaveLength(2);
    const heading = form.querySelector<HTMLElement>("[data-field=heading]");
    const body = form.querySelector<HTMLElement>(".editor-text-body");
    if (!heading || !body) throw new Error("text");
    expect(heading.textContent).toBe("Market");
    expect(body.querySelectorAll("p")).toHaveLength(2);
    expect(body.querySelector("ul")).toBeTruthy();

    heading.textContent = "Saturday market";
    heading.dispatchEvent(new dom.Event("input", { bubbles: true }));
    body.innerHTML = "<p>Opens at nine.</p><p>Closes at one.</p><p>Dogs welcome.</p><ul><li>Bread</li></ul>";
    body.dispatchEvent(new dom.Event("input", { bubbles: true }));
    const level = form.querySelector<HTMLSelectElement>("[data-field=level]");
    if (!level) throw new Error("level");
    level.value = "3";
    level.dispatchEvent(new dom.Event("change", { bubbles: true }));

    const html = readComposeHtml(form).main ?? "";
    expect(html).toContain('<div class="tessera-text"><h3>Saturday market</h3><p>Opens at nine.</p><p>Closes at one.</p><p>Dogs welcome.</p><ul><li>Bread</li></ul></div>');
    expect(html).toContain('data-tessera="gallery"');
    expect(html.match(/tessera-text/g)).toHaveLength(1);

    const labels = [...form.querySelectorAll(".editor-mark")].map((button) => button.getAttribute("aria-label"));
    expect(labels).toContain("Bold");
    expect(labels).toContain("Italic");
    expect(labels).toContain("Underline");
    expect(labels).toContain("Align left");
    expect(form.querySelector("[data-cmd=bold] b")?.textContent).toBe("B");
    expect(form.querySelector("[data-cmd=italic] i")?.textContent).toBe("I");

    body.innerHTML = `<p class="w3-center"><b>Hi</b> <u>under</u> <strike>gone</strike> <code>id</code></p>`;
    body.dispatchEvent(new dom.Event("input", { bubbles: true }));
    const marked = readComposeHtml(form).main ?? "";
    expect(marked).toContain('<p class="w3-center"><b>Hi</b> <u>under</u> <s>gone</s> <code>id</code></p>');

    form.querySelector(`[data-palette="text"]`)?.dispatchEvent(new dom.MouseEvent("click", { bubbles: true }));
    const added = form.querySelectorAll(".editor-text");
    expect(added).toHaveLength(2);
    const blank = added[1]?.querySelector<HTMLElement>("[data-field=heading]");
    expect(blank?.textContent).toBe("");
    expect(blank?.getAttribute("data-placeholder")).toBe("Heading");
  });

  it("keeps a locked page's words editable and its structure fixed", () => {
    dom.document.body.innerHTML = `<form>
      <button type="button" data-palette="text">Text</button>
      <div data-canvas data-zone="main"></div>
    </form>`;
    const form = dom.document.querySelector("form");
    if (!(form instanceof dom.HTMLFormElement)) throw new Error("form");
    mountComposeCanvases(form, {
      bindings: [],
      folders: [{ id: "lambs", title: "Lambs" }],
      htmlByZone: {
        main: `<h2>Animal name</h2><div class="tessera-page-gallery" data-tessera="gallery" data-folder="" data-mode="grid"></div>`,
      },
      locked: true,
    });

    expect(form.querySelector("[data-remove]")).toBeNull();
    expect(form.querySelector("[data-drag]")).toBeNull();
    expect(form.querySelector("[data-drop]")).toBeNull();
    expect(form.querySelector("[data-field=level]")).toBeNull();
    expect(form.querySelector("[data-field=mode]")).toBeNull();
    expect(form.querySelector("[data-field=folder]")).toBeTruthy();
    expect(form.querySelectorAll("[data-item-id]")).toHaveLength(2);

    form.querySelector(`[data-palette="text"]`)?.dispatchEvent(new dom.MouseEvent("click", { bubbles: true }));
    expect(form.querySelectorAll("[data-item-id]")).toHaveLength(2);

    const heading = form.querySelector<HTMLElement>("[data-field=text]");
    if (!heading) throw new Error("heading");
    heading.textContent = "Daisy";
    heading.dispatchEvent(new dom.Event("input", { bubbles: true }));
    const html = readComposeHtml(form).main ?? "";
    expect(html).toContain("Daisy");
    expect(html).not.toContain("Animal name");
  });
});
