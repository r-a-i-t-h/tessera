// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./maximized-code-editor.js", () => ({
  mountMaximizedCodeEditor: vi.fn(() => ({
    focus: vi.fn(),
    destroy: vi.fn(),
  })),
}));

import {
  bindStylesheetEditors,
  openMaximizedStylesheet,
  readStyleTokensOpen,
  readStylesheetOpen,
  stylesheetEditors,
  styleSpecimenHtml,
  stylesPageHtml,
} from "./styles-page.js";
import { resolveSiteStyle } from "@r-a-i-t-h/tessera-model";

const panelStore = new Map<string, string>();

function stubPanelStorage(): void {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => panelStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      panelStore.set(key, value);
    },
    removeItem: (key: string) => {
      panelStore.delete(key);
    },
  });
}

describe("site style page", () => {
  it("links token overrides to the Tessera stylesheet editor", () => {
    expect(stylesPageHtml({ style: {} })).toContain('href="#/styles?sheet=tessera">Tessera</a>');
  });

  it("places the token form left and chrome preview right", () => {
    const html = stylesPageHtml({ style: {} });
    expect(html).toContain('class="style-tokens-layout"');
    const layout = html.match(/<div class="style-tokens-layout">([\s\S]*?)<\/div>\s*<\/details>/)?.[1] ?? "";
    const formIndex = layout.indexOf('id="style-form"');
    const specimenIndex = layout.indexOf('id="style-specimen"');
    expect(formIndex).toBeGreaterThan(-1);
    expect(specimenIndex).toBeGreaterThan(formIndex);
    expect(layout).toContain('class="style-tokens-preview"');
  });

  it("renders expanded tessera widgets in the specimen", () => {
    const html = styleSpecimenHtml(resolveSiteStyle({}));
    expect(html).toContain("tessera-breadcrumbs");
    expect(html).toContain("tessera-toc");
    expect(html).toContain("tessera-link-pill");
    expect(html).toContain("tessera-link-card");
    expect(html).toContain("is-active");
    expect(html).toContain("tessera-footer");
    expect(html).toContain("tessera-card");
    expect(html).toContain("rt-card-body");
    expect(html).toContain("tessera-imgbox");
    expect(html).toContain("tessera-dataset-table");
    expect(html).toContain("tessera-dataset-table__head");
    expect(html).toContain("tessera-dataset-card");
  });
});

describe("style panel persistence", () => {
  beforeEach(() => {
    panelStore.clear();
    stubPanelStorage();
  });

  afterEach(() => {
    panelStore.clear();
    vi.unstubAllGlobals();
  });

  it("defaults Site style open and site layout sheet open", () => {
    expect(readStyleTokensOpen()).toBe(true);
    expect(readStylesheetOpen("site")).toBe(true);
    expect(readStylesheetOpen("w3")).toBe(false);
  });

  it("restores saved open state from localStorage", () => {
    localStorage.setItem(
      "tessera.styles.panels",
      JSON.stringify({ tokens: false, sheets: { w3: true, site: false } }),
    );
    expect(readStyleTokensOpen()).toBe(false);
    expect(readStylesheetOpen("w3")).toBe(true);
    expect(readStylesheetOpen("site")).toBe(false);
  });
});

describe("stylesheet editors", () => {
  beforeEach(() => {
    panelStore.clear();
    stubPanelStorage();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    panelStore.clear();
    vi.unstubAllGlobals();
  });

  it("renders maximize and normalize controls beside each sheet editor", () => {
    const html = stylesheetEditors([{ id: "site", label: "Site layout", text: ".x {}", overridden: false }]);
    expect(html).toContain("data-sheet-maximize>Maximize</button>");
    expect(html).toContain('class="w3-button w3-white style-sheet-normalize" data-sheet-normalize');
    expect(html).toContain('data-sheet="site"');
    expect(html).toContain("data-code-wrap");
    expect(html).toContain('id="style-site"');
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

  it("maximizes a collapsed stylesheet panel", () => {
    localStorage.setItem(
      "tessera.styles.panels",
      JSON.stringify({ sheets: { site: false } }),
    );
    document.body.innerHTML = stylesheetEditors([
      { id: "site", label: "Site layout", text: ".x {}", overridden: false },
    ]);
    const form = document.querySelector<HTMLFormElement>('form[data-sheet="site"]')!;
    const sheet = form.closest<HTMLDetailsElement>("details.style-sheet")!;
    expect(sheet.open).toBe(false);

    bindStylesheetEditors(document.body, () => {});
    expect(openMaximizedStylesheet(document.body, "site")).toBe(true);
    expect(sheet.open).toBe(true);
    expect(sheet.classList.contains("style-sheet--maximized")).toBe(true);
  });
});
