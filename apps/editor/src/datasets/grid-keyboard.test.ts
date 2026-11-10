/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it, afterEach } from "vitest";
import { LIST_ITEM_ACTIVE_CLASS } from "../list-keyboard.js";
import { handleDatasetGridKeyboard, navigableDatasetGridRows } from "./grid-keyboard.js";

function page(html: string): HTMLElement {
  const root = document.createElement("div");
  root.id = "editor-root";
  root.innerHTML = `<main class="editor-main">${html}</main>`;
  document.body.appendChild(root);
  return root;
}

const gridShell = (body: string, viewMode = true) => `
  <div class="editor-dataset-page" data-dataset-id="events">
    ${viewMode ? '<button type="button" data-dataset-edit-mode>Edit grid</button>' : ""}
    <table class="editor-dataset-grid"><tbody>${body}</tbody></table>
  </div>`;

describe("handleDatasetGridKeyboard", () => {
  let root: HTMLElement;

  afterEach(() => {
    root?.remove();
  });

  it("does nothing for Enter until ArrowDown selects the first row", () => {
    root = page(gridShell(`
      <tr data-record-row="1"><td data-open-record="1">One</td></tr>
      <tr data-record-row="2"><td data-open-record="2">Two</td></tr>
    `));
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    expect(handleDatasetGridKeyboard(root, enter)).toBe(false);

    const down = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true });
    expect(handleDatasetGridKeyboard(root, down)).toBe(true);
    const first = root.querySelector("tr[data-record-row='1']");
    expect(first?.classList.contains(LIST_ITEM_ACTIVE_CLASS)).toBe(true);

    let opened: number | undefined;
    root.querySelector("[data-open-record='1']")?.addEventListener("click", () => {
      opened = 1;
    });
    const enter2 = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    expect(handleDatasetGridKeyboard(root, enter2)).toBe(true);
    expect(opened).toBe(1);
  });

  it("ArrowUp from no selection highlights the last row", () => {
    root = page(gridShell(`
      <tr data-record-row="1"><td data-open-record="1">One</td></tr>
      <tr data-record-row="2"><td data-open-record="2">Two</td></tr>
    `));
    const up = new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true });
    expect(handleDatasetGridKeyboard(root, up)).toBe(true);
    expect(root.querySelector("tr[data-record-row='2']")?.classList.contains(LIST_ITEM_ACTIVE_CLASS)).toBe(true);
  });

  it("does not run while Edit grid mode is active", () => {
    root = page(gridShell(`<tr data-record-row="1"><td data-open-record="1">One</td></tr>`, false));
    const down = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true });
    expect(handleDatasetGridKeyboard(root, down)).toBe(false);
  });

  it("ignores keydown when focus is in a filter field", () => {
    root = page(`${gridShell(`<tr data-record-row="1"><td data-open-record="1">One</td></tr>`)}
      <input class="w3-input" data-filter-col="title" />`);
    const input = root.querySelector("input")!;
    const down = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true });
    Object.defineProperty(down, "target", { value: input });
    expect(handleDatasetGridKeyboard(root, down)).toBe(false);
  });
});

describe("navigableDatasetGridRows", () => {
  it("omits hidden rows", () => {
    const root = page(gridShell(`
      <tr data-record-row="1" hidden><td data-open-record="1">One</td></tr>
      <tr data-record-row="2"><td data-open-record="2">Two</td></tr>
    `));
    const datasetPage = root.querySelector(".editor-dataset-page")!;
    expect(navigableDatasetGridRows(datasetPage)).toHaveLength(1);
    root.remove();
  });
});
