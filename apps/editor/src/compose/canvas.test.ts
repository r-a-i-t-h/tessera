import { parseSections } from "@r-a-i-t-h/tessera-sections";
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
      folders: [{ id: "lambs" }],
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
    expect(html).toContain('<div class="tessera-block tessera-text"><h3>Saturday market</h3><p>Opens at nine.</p><p>Closes at one.</p><p>Dogs welcome.</p><ul><li>Bread</li></ul></div>');
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

  it("shows saved anchors as markdown while editing and stores anchors again", () => {
    dom.document.body.innerHTML = `<form><div data-canvas data-zone="main"></div></form>`;
    const form = dom.document.querySelector("form");
    if (!(form instanceof dom.HTMLFormElement)) throw new Error("form");
    mountComposeCanvases(form, {
      bindings: [],
      htmlByZone: {
        main: `<div class="tessera-text"><h2>Title</h2><p>See <a href="https://example.com/hall">Hall</a>.</p></div>`,
      },
    });

    const body = form.querySelector<HTMLElement>(".editor-text-body");
    if (!body) throw new Error("body");
    expect(body.textContent).toContain("[Hall](https://example.com/hall)");
    expect(body.innerHTML).not.toMatch(/<a\s/i);

    body.innerHTML = "<p>Visit [Hall](https://example.com/hall) today.</p>";
    body.dispatchEvent(new dom.Event("input", { bubbles: true }));
    const html = readComposeHtml(form).main ?? "";
    expect(html).toContain('<a href="https://example.com/hall">Hall</a>');
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
      folders: [{ id: "lambs" }],
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

describe("compose drag ghost", () => {
  it("shows the palette label while a section is dragged on", () => {
    const form = mount(`<button type="button" data-palette="pasted">Pasted note</button><div data-canvas data-zone="main"></div>`);
    const button = form.querySelector("[data-palette=pasted]");
    if (!button) throw new Error("palette");
    expect(dragGhost(button).textContent).toBe("Pasted note");
  });

  it("marks the form while a drag is active", () => {
    const form = mount(`<button type="button" data-palette="pasted">Pasted note</button><div data-canvas data-zone="main"></div>`);
    const button = form.querySelector("[data-palette=pasted]");
    if (!button) throw new Error("palette");
    fireDragStart(button);
    expect(form.classList.contains("editor-dragging")).toBe(true);
    form.dispatchEvent(new dom.Event("dragend", { bubbles: true }));
    expect(form.classList.contains("editor-dragging")).toBe(false);
  });

  it("keeps drop preview visible while hovering a slot", () => {
    const form = mount(`<button type="button" data-palette="pasted">Pasted note</button><div data-canvas data-zone="main"></div>`);
    const button = form.querySelector("[data-palette=pasted]");
    const slot = form.querySelector("[data-drop]");
    if (!button || !slot) throw new Error("drag sources");
    fireDragStart(button);
    const over = new dom.Event("dragover", { bubbles: true });
    Object.defineProperty(over, "dataTransfer", { value: { dropEffect: "" } });
    slot.dispatchEvent(over);
    expect(form.classList.contains("editor-dragging")).toBe(true);
    expect(slot.classList.contains("editor-drop-active")).toBe(true);
  });

  it("sets move dropEffect while reordering a section", () => {
    const form = mountZone(`<h2>First</h2><h2>Second</h2>`);
    const handle = form.querySelector("[data-drag]");
    const slot = form.querySelector("[data-drop]");
    if (!handle || !slot) throw new Error("drag sources");
    fireDragStart(handle);
    const transfer = { dropEffect: "" };
    const over = new dom.Event("dragover", { bubbles: true });
    Object.defineProperty(over, "dataTransfer", { value: transfer });
    slot.dispatchEvent(over);
    expect(transfer.dropEffect).toBe("move");
  });

  it("reorders when drop dataTransfer getData is empty", () => {
    const form = mountZone(`<h2>First</h2><h2>Second</h2>`);
    const handle = form.querySelector("[data-drag]");
    const slots = form.querySelectorAll("[data-drop]");
    const afterSecond = slots[slots.length - 1];
    if (!handle || !afterSecond) throw new Error("drag sources");
    fireDragStart(handle);
    dropWithEmptyTransfer(afterSecond);
    const headings = [...form.querySelectorAll("[data-field=text]")].map((node) => node.textContent);
    expect(headings).toEqual(["Second", "First"]);
  });

  it("shows the section kind while an existing section is moved", () => {
    dom.document.body.innerHTML = `<form><div data-canvas data-zone="main"></div></form>`;
    const form = dom.document.querySelector("form");
    if (!(form instanceof dom.HTMLFormElement)) throw new Error("form");
    mountComposeCanvases(form, {
      bindings: [],
      htmlByZone: { main: `<h2>Market</h2><p>Opens at nine.</p>` },
    });
    const handle = form.querySelector("[data-drag]");
    if (!handle) throw new Error("handle");
    expect(dragGhost(handle).textContent).toBe("Text");
  });
});

describe("editing toolbar visibility", () => {
  it("hides formatting controls until the section is focused", () => {
    dom.document.head.innerHTML = `<style>.editor-section-editing-tools { display: none; }</style>`;
    dom.document.body.innerHTML = `<form><div data-canvas data-zone="main"></div></form>`;
    const form = dom.document.querySelector("form");
    if (!(form instanceof dom.HTMLFormElement)) throw new Error("form");
    mountComposeCanvases(form, {
      bindings: [],
      htmlByZone: { main: `<h2>Title</h2><p>Body copy.</p>` },
    });

    const section = form.querySelector(".editor-section");
    if (!(section instanceof dom.HTMLElement)) throw new Error("section");
    const tools = section.querySelector(".editor-section-editing-tools");
    if (!(tools instanceof dom.HTMLElement)) throw new Error("editing tools");
    const bold = section.querySelector<HTMLElement>("[data-cmd=bold]");
    if (!bold) throw new Error("bold");

    expect(dom.window.getComputedStyle(tools).display).toBe("none");
    expect(dom.window.getComputedStyle(section.querySelector("[data-drag]")!).display).not.toBe("none");
    expect(dom.window.getComputedStyle(section.querySelector(".editor-section-actions")!).display).not.toBe("none");

    expect(section.querySelector("[data-field=level]")?.closest(".editor-section-editing-tools")).toBeNull();
    expect(bold.closest(".editor-section-editing-tools")).toBe(tools);
  });
});

describe("section actions", () => {
  it("groups up, down, and remove on the right and moves a section from the icon", () => {
    dom.document.body.innerHTML = `<form><div data-canvas data-zone="main"></div></form>`;
    const form = dom.document.querySelector("form");
    if (!(form instanceof dom.HTMLFormElement)) throw new Error("form");
    mountComposeCanvases(form, {
      bindings: [],
      htmlByZone: { main: `<h2>First</h2><h2>Second</h2>` },
    });

    const groups = [...form.querySelectorAll(".editor-section-actions")];
    expect(groups).toHaveLength(2);
    const labels = [...groups[0]!.querySelectorAll("button")].map((button) => button.getAttribute("aria-label"));
    expect(labels).toEqual(["Up", "Down", "Remove"]);
    expect(groups[0]!.querySelector<HTMLButtonElement>("[data-move=up]")?.disabled).toBe(true);
    expect(groups[1]!.querySelector<HTMLButtonElement>("[data-move=down]")?.disabled).toBe(true);
    const bar = groups[0]!.parentElement;
    expect(bar?.lastElementChild).toBe(groups[0]);

    const icon = groups[0]!.querySelector("[data-move=down] svg");
    if (!icon) throw new Error("down icon");
    icon.dispatchEvent(new dom.MouseEvent("click", { bubbles: true }));

    const kinds = [...form.querySelectorAll(".editor-section-kind")].map((node) => node.textContent);
    expect(kinds[0]).toBe("Heading");
    const headings = [...form.querySelectorAll("[data-field=text]")].map((node) => node.textContent);
    expect(headings).toEqual(["Second", "First"]);
  });
});

describe("image frame", () => {
  it("hides the frame and keeps the padding", () => {
    const form = mountZone(
      `<div class="tessera-imgbox w3-display-container w3-container w3-padding-16 w3-card w3-center"><img src="./media/porch.svg" class="w3-image" alt="Porch"></div>`,
    );
    const box = form.querySelector(".tessera-imgbox");
    expect(box?.classList.contains("w3-card")).toBe(true);
    expect(box?.classList.contains("w3-padding-16")).toBe(true);
    const hide = form.querySelector<HTMLInputElement>("[data-field=plain]");
    if (!hide) throw new Error("hide frame");
    hide.checked = true;
    hide.dispatchEvent(new dom.Event("change", { bubbles: true }));
    const next = form.querySelector(".tessera-imgbox");
    expect(next?.classList.contains("w3-card")).toBe(false);
    expect(next?.classList.contains("w3-padding-16")).toBe(true);
    const html = readComposeHtml(form).main ?? "";
    expect(html).toContain("w3-padding-16");
    expect(html).not.toContain("w3-card");
  });
});

describe("side by side layouts", () => {
  it("switches ratios and keeps the cells", () => {
    const form = mountZone(
      `<div class="w3-row-padding w3-stretch"><div class="w3-half"><p>Left</p></div><div class="w3-half"><p>Right</p></div></div>`,
    );
    const select = form.querySelector<HTMLSelectElement>("[data-field=layout]");
    if (!select) throw new Error("layout");
    expect(select.value).toBe("1:1");
    chooseLayout(form, "2:1");
    let html = readComposeHtml(form).main ?? "";
    expect(html).toContain('class="w3-twothird"');
    expect(html).toContain('class="w3-third"');
    expect(html).toContain("<p>Left</p>");
    expect(html).toContain("<p>Right</p>");

    const nested = form.querySelector(".editor-cell [data-drop]");
    if (!nested) throw new Error("column slot");
    dropPalette(nested, "columns");
    expect(form.querySelectorAll(".editor-cell")).toHaveLength(2);

    chooseLayout(form, "1:2:1");
    html = readComposeHtml(form).main ?? "";
    expect(html).toContain('class="w3-quarter"');
    expect(html).toContain('class="w3-half"');
    expect(form.querySelectorAll(".editor-cell")).toHaveLength(3);
  });
});

describe("text spacing", () => {
  it("keeps blank paragraphs before and after words", () => {
    const form = mountZone(
      `<div class="tessera-text"><p><br></p><p>Hello</p><p><br></p><p><br></p></div>`,
    );
    const html = readComposeHtml(form).main ?? "";
    expect(html).toContain("<p><br></p><p>Hello</p><p><br></p><p><br></p>");
  });

  it("stores no body html when only blank paragraphs remain", () => {
    const form = mountZone(`<div class="tessera-text"><p>Hi</p></div>`);
    const body = form.querySelector<HTMLElement>(".editor-text-body");
    if (!body) throw new Error("body");
    body.innerHTML = "<p><br></p>";
    body.dispatchEvent(new dom.Event("input", { bubbles: true }));
    const html = readComposeHtml(form).main ?? "";
    expect(html).not.toContain("tessera-text");
    expect(html).not.toContain("<p>");
  });

  it("round-trips Super space on a text block", () => {
    const form = mountZone(`<div class="tessera-text tessera-loose"><p>Wide</p></div>`);
    expect(form.querySelector(".editor-text.tessera-loose")).toBeTruthy();
    let html = readComposeHtml(form).main ?? "";
    expect(html).toContain("tessera-loose");
    expect(parseSections(html)[0]).toMatchObject({ kind: "text", loose: true });

    const loose = form.querySelector<HTMLInputElement>('[data-field="loose"]');
    if (!loose) throw new Error("loose");
    expect(loose.checked).toBe(true);
    loose.checked = false;
    loose.dispatchEvent(new dom.Event("change", { bubbles: true }));
    html = readComposeHtml(form).main ?? "";
    expect(html).not.toContain("tessera-loose");
    expect(parseSections(html)[0]).not.toMatchObject({ loose: true });
  });
});

describe("card container", () => {
  it("holds text and side by side", () => {
    const form = mountZone(
      `<div class="w3-card w3-padding w3-margin-bottom w3-white"><h3 class="w3-text-theme">Visit</h3><div class="rt-card-body"><div class="tessera-text"><p>Open at nine.</p></div></div></div>`,
    );
    const card = form.querySelector(".w3-card");
    const slot = card?.querySelector<HTMLElement>("[data-drop]");
    if (!card || !slot) throw new Error("card");
    expect(card.querySelector(".editor-section-kind")?.textContent).toBe("Text");
    dropPalette(slot, "columns");
    const html = readComposeHtml(form).main ?? "";
    const sections = parseSections(html);
    expect(sections).toMatchObject([
      {
        kind: "card",
        title: "Visit",
        sections: [
          { kind: "columns", layout: "1:1" },
          { kind: "text", html: "<p>Open at nine.</p>" },
        ],
      },
    ]);
  });
});

describe("image preview", () => {
  it("shows a library image from the preview and keeps the published address", () => {
    dom.document.body.innerHTML = `<form><div data-canvas data-zone="main"></div></form>`;
    const form = dom.document.querySelector("form");
    if (!(form instanceof dom.HTMLFormElement)) throw new Error("form");
    mountComposeCanvases(form, {
      bindings: [],
      htmlByZone: {
        main: `<div class="tessera-imgbox w3-display-container w3-container w3-padding-16 w3-card w3-center"><img src="./media/porch.svg" class="w3-image" alt="Porch"></div>`,
      },
    });
    expect(form.querySelector(".tessera-imgbox img")?.getAttribute("src")).toBe("/preview/media/porch.svg");
    const src = form.querySelector<HTMLInputElement>("[data-field=src]");
    if (!src) throw new Error("src");
    expect(src.value).toBe("./media/porch.svg");
    src.value = "./media/gate.png";
    src.dispatchEvent(new dom.Event("change", { bubbles: true }));
    expect(form.querySelector(".tessera-imgbox img")?.getAttribute("src")).toBe("/preview/media/gate.png");
    expect(readComposeHtml(form).main).toContain('src="./media/gate.png"');
  });
});

function mountZone(main: string): HTMLFormElement {
  dom.document.body.innerHTML = `<form><div data-canvas data-zone="main"></div></form>`;
  const form = dom.document.querySelector("form");
  if (!(form instanceof dom.HTMLFormElement)) throw new Error("form");
  mountComposeCanvases(form, { bindings: [], htmlByZone: { main } });
  return form;
}

function chooseLayout(form: HTMLFormElement, layout: string): void {
  const select = form.querySelector<HTMLSelectElement>("[data-field=layout]");
  if (!select) throw new Error("layout");
  select.value = layout;
  select.dispatchEvent(new dom.Event("change", { bubbles: true }));
}

function dropPalette(slot: Element, kind: string): void {
  const transfer = {
    dropEffect: "",
    getData(type: string) {
      if (type === "application/x-tessera-palette") return kind;
      return kind;
    },
  };
  const event = new dom.Event("drop", { bubbles: true });
  Object.defineProperty(event, "dataTransfer", { value: transfer });
  slot.dispatchEvent(event);
}

function dropWithEmptyTransfer(slot: Element): void {
  const transfer = {
    dropEffect: "",
    getData() {
      return "";
    },
  };
  const event = new dom.Event("drop", { bubbles: true });
  Object.defineProperty(event, "dataTransfer", { value: transfer });
  slot.dispatchEvent(event);
}

function mount(inner: string): HTMLFormElement {
  dom.document.body.innerHTML = `<form>${inner}</form>`;
  const form = dom.document.querySelector("form");
  if (!(form instanceof dom.HTMLFormElement)) throw new Error("form");
  mountComposeCanvases(form, { bindings: [], htmlByZone: { main: "" } });
  return form;
}

function fireDragStart(target: Element): void {
  const transfer = {
    effectAllowed: "",
    setData() {},
    setDragImage() {},
  };
  const event = new dom.Event("dragstart", { bubbles: true });
  Object.defineProperty(event, "dataTransfer", { value: transfer });
  target.dispatchEvent(event);
}

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
  target.dispatchEvent(new dom.Event("dragend", { bubbles: true }));
  return ghost;
}
