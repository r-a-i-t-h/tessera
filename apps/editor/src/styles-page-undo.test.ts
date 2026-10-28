// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { STYLE_FIELDS } from "./forms/style.js";
import { applyStyleFormSnapshot, bindStyleFormUndo, styleFormSnapshot } from "./styles-page.js";

describe("site style undo", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("snapshots and restores all style fields", () => {
    document.body.innerHTML = `<form id="style-form">${STYLE_FIELDS.map(
      (field) =>
        `<input name="${field.name}" value="${field.name === "bar" ? "#009688" : field.name === "navSide" ? "right" : "x"}" />`,
    ).join("")}</form>`;
    const form = document.querySelector<HTMLFormElement>("#style-form")!;
    const snapshot = styleFormSnapshot(form);
    const bar = form.elements.namedItem("bar") as HTMLInputElement;
    bar.value = "#ff0000";
    expect(applyStyleFormSnapshot(form, snapshot)).toBe(true);
    expect(bar.value).toBe("#009688");
  });

  it("undoes a token edit", () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    document.body.innerHTML = `<form id="style-form"><input name="bar" class="style-color-value-input" value="#009688" /><button type="button" data-action="undo">Undo</button></form>`;
    const form = document.querySelector<HTMLFormElement>("#style-form")!;
    const bar = form.elements.namedItem("bar") as HTMLInputElement;
    const baseline = styleFormSnapshot(form);
    bindStyleFormUndo(document.body, form, baseline, () => {});
    bar.value = "#111111";
    bar.dispatchEvent(new Event("input", { bubbles: true }));
    expect(bar.value).toBe("#111111");
    document.querySelector<HTMLButtonElement>("[data-action=undo]")!.click();
    expect(bar.value).toBe("#009688");
  });
});
