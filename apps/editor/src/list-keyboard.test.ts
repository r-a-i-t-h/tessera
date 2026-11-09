/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it, afterEach } from "vitest";
import {
  LIST_ITEM_ACTIVE_CLASS,
  clearListKeyboardSelection,
  handleListKeyboard,
} from "./list-keyboard.js";

function page(html: string): HTMLElement {
  const root = document.createElement("div");
  root.id = "editor-root";
  root.innerHTML = `<main class="editor-main">${html}</main>`;
  document.body.appendChild(root);
  return root;
}

describe("handleListKeyboard", () => {
  let root: HTMLElement;

  afterEach(() => {
    root?.remove();
    window.location.hash = "";
  });

  it("does nothing for Enter until ArrowDown selects the first row", () => {
    root = page(`<ul class="w3-ul">
      <li class="editor-list-item"><a class="editor-list-row" href="#/content/a">A</a></li>
      <li class="editor-list-item"><a class="editor-list-row" href="#/content/b">B</a></li>
    </ul>`);
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    expect(handleListKeyboard(root, enter)).toBe(false);

    const down = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true });
    expect(handleListKeyboard(root, down)).toBe(true);
    const first = root.querySelector("li.editor-list-item");
    expect(first?.classList.contains(LIST_ITEM_ACTIVE_CLASS)).toBe(true);

    const enter2 = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    expect(handleListKeyboard(root, enter2)).toBe(true);
    expect(window.location.hash).toBe("#/content/a");
  });

  it("ArrowUp from no selection highlights the last row", () => {
    root = page(`<ul class="w3-ul">
      <li class="editor-list-item"><a class="editor-list-row" href="#/content/a">A</a></li>
      <li class="editor-list-item"><a class="editor-list-row" href="#/content/b">B</a></li>
    </ul>`);
    const up = new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true });
    expect(handleListKeyboard(root, up)).toBe(true);
    const rows = [...root.querySelectorAll("li.editor-list-item")];
    expect(rows[1]?.classList.contains(LIST_ITEM_ACTIVE_CLASS)).toBe(true);
  });

  it("skips hidden rows after filtering", () => {
    root = page(`<ul class="w3-ul" id="entry-list">
      <li class="editor-list-item" hidden><a class="editor-list-row" href="#/content/hidden">H</a></li>
      <li class="editor-list-item"><a class="editor-list-row" href="#/content/visible">V</a></li>
    </ul>`);
    const down = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true });
    handleListKeyboard(root, down);
    const visible = root.querySelector('a[href="#/content/visible"]')?.closest("li");
    expect(visible?.classList.contains(LIST_ITEM_ACTIVE_CLASS)).toBe(true);
  });

  it("does not run on record edit screens", () => {
    root = page(`<form id="record-form"></form>
      <ul class="w3-ul"><li class="editor-list-item"><a class="editor-list-row" href="#/x">X</a></li></ul>`);
    const down = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true });
    expect(handleListKeyboard(root, down)).toBe(false);
  });
});

describe("clearListKeyboardSelection", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("removes the active class from list rows", () => {
    const root = page(`<ul class="w3-ul">
      <li class="editor-list-item ${LIST_ITEM_ACTIVE_CLASS}">Row</li>
    </ul>`);
    clearListKeyboardSelection(root);
    expect(root.querySelector(`.${LIST_ITEM_ACTIVE_CLASS}`)).toBeNull();
    root.remove();
  });
});
