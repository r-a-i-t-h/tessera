/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { applyNavPalettePageFilter } from "./canvas.js";

describe("nav palette page filter", () => {
  it("hides non-matching pages as the query changes", () => {
    const root = document.createElement("div");
    root.innerHTML = `<input data-nav-palette-filter="pages" />
      <div data-nav-palette-pages>
        <button type="button" data-nav-palette-filter-text="home home">Home</button>
        <button type="button" data-nav-palette-filter-text="about us about">About</button>
      </div>`;
    const filter = root.querySelector<HTMLInputElement>("[data-nav-palette-filter='pages']")!;
    filter.value = "about";
    applyNavPalettePageFilter(root);
    const buttons = [...root.querySelectorAll<HTMLButtonElement>("[data-nav-palette-filter-text]")];
    expect(buttons.find((b) => b.dataset.navPaletteFilterText?.startsWith("home"))?.hidden).toBe(true);
    expect(buttons.find((b) => b.dataset.navPaletteFilterText?.startsWith("about"))?.hidden).toBe(false);
    filter.value = "";
    applyNavPalettePageFilter(root);
    expect(buttons.every((b) => !b.hidden)).toBe(true);
  });
});
