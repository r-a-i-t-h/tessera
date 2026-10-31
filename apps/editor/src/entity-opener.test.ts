/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it, vi } from "vitest";
import { bindEntityOpener, closeEntityOpener, entityOpenerHtml, openEntityOpener } from "./entity-opener.js";
import { handleEscape } from "./escape-key.js";

const items = [
  { id: "about", label: "About", hash: "#/content/about", filterText: "about" },
  { id: "contact", label: "Contact", hash: "#/content/contact", filterText: "contact" },
];

describe("entityOpenerHtml", () => {
  it("falls back to h1 when there are no other entities", () => {
    expect(entityOpenerHtml("Home", "home", [])).toContain("<h1");
    expect(entityOpenerHtml("Home", "home", [])).not.toContain("data-entity-open");
  });
});

describe("bindEntityOpener", () => {
  it("filters the list from the search field", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    root.innerHTML = entityOpenerHtml("Home", "home", items);
    bindEntityOpener(root);
    root.querySelector<HTMLButtonElement>("[data-entity-opener-toggle]")?.click();

    const input = root.querySelector<HTMLInputElement>(".editor-entity-opener-search")!;
    input.value = "cont";
    input.dispatchEvent(new Event("input"));
    vi.advanceTimersByTime(150);
    vi.useRealTimers();

    const options = root.querySelectorAll('[role="option"]');
    expect(options.length).toBe(1);
    expect(options[0]?.textContent).toContain("Contact");
  });

  it("navigates on Enter when a row is highlighted", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    root.innerHTML = entityOpenerHtml("Home", "home", items);
    bindEntityOpener(root);
    root.querySelector<HTMLButtonElement>("[data-entity-opener-toggle]")?.click();

    const input = root.querySelector<HTMLInputElement>(".editor-entity-opener-search")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(window.location.hash).toBe("#/content/about");
    vi.useRealTimers();
  });

  it("closes before escape navigates back", () => {
    const root = document.createElement("div");
    root.innerHTML = `${entityOpenerHtml("Home", "home", items)}
      <a class="editor-back" href="#/pages">Back</a>`;
    bindEntityOpener(root);
    openEntityOpener(root);
    window.location.hash = "#/content/home";

    expect(handleEscape(root)).toBe(true);
    expect(root.querySelector(".editor-entity-opener-panel")?.hidden).toBe(true);
    expect(window.location.hash).toBe("#/content/home");
  });

  it("closeEntityOpener returns true when a panel was open", () => {
    const root = document.createElement("div");
    root.innerHTML = entityOpenerHtml("Home", "home", items);
    bindEntityOpener(root);
    openEntityOpener(root);
    expect(closeEntityOpener(root)).toBe(true);
    expect(root.querySelector(".editor-entity-opener-panel")?.hidden).toBe(true);
  });
});
