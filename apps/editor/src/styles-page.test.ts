// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import { bindStylesheetEditors, stylesheetEditors } from "./styles-page.js";

describe("stylesheet editors", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders maximize and normalize controls beside each sheet editor", () => {
    const html = stylesheetEditors([{ id: "site", label: "Site layout", text: ".x {}", overridden: false }]);
    expect(html).toContain("data-sheet-maximize>Maximize</button>");
    expect(html).toContain('class="w3-button w3-white style-sheet-normalize" data-sheet-normalize');
    expect(html).toContain('data-sheet="site"');
  });

  it("toggles maximize overlay and restores on normalize", () => {
    document.body.innerHTML = stylesheetEditors([
      { id: "site", label: "Site layout", text: ".x {}", overridden: false },
    ]);
    const form = document.querySelector<HTMLFormElement>('form[data-sheet="site"]')!;
    const sheet = form.closest<HTMLDetailsElement>("details.style-sheet")!;
    const maximize = form.querySelector<HTMLButtonElement>("[data-sheet-maximize]")!;
    const normalize = form.querySelector<HTMLButtonElement>("[data-sheet-normalize]")!;
    bindStylesheetEditors(document.body, () => {});

    expect(normalize.matches(".style-sheet-normalize")).toBe(true);
    expect(sheet.classList.contains("style-sheet--maximized")).toBe(false);

    maximize.click();
    expect(sheet.classList.contains("style-sheet--maximized")).toBe(true);
    expect(form.getAttribute("role")).toBe("dialog");

    expect(document.querySelector(".style-sheet-overlay-host")).not.toBeNull();

    normalize.click();
    expect(sheet.classList.contains("style-sheet--maximized")).toBe(false);
    expect(form.hasAttribute("role")).toBe(false);
    expect(document.querySelector(".style-sheet-overlay-host")).toBeNull();
    expect(sheet.contains(form)).toBe(true);
  });
});
