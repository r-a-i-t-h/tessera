/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it } from "vitest";
import { handleEscape, libraryParentHash } from "./escape-key.js";

describe("handleEscape", () => {
  it("closes a visible new-record form before navigating back", () => {
    const root = document.createElement("div");
    root.innerHTML = `<form id="new-page-form" class="editor-new-page">
        <p data-form-error class="w3-panel" role="alert">Bad id</p>
      </form>
      <a class="editor-back" href="#/pages">Back</a>`;
    window.location.hash = "#/records/content";

    expect(handleEscape(root)).toBe(true);
    const form = root.querySelector<HTMLFormElement>("#new-page-form");
    expect(form?.hidden).toBe(true);
    expect(root.querySelector("[data-form-error]")?.hidden).toBe(true);
  });

  it("steps the binding wizard back before hiding it", () => {
    const root = document.createElement("div");
    root.innerHTML = `<form id="new-binding-form">
        <button type="button" data-binding-step="back">Back</button>
      </form>`;
    let clicks = 0;
    root.querySelector("[data-binding-step=back]")?.addEventListener("click", () => {
      clicks += 1;
    });

    expect(handleEscape(root)).toBe(true);
    expect(clicks).toBe(1);
  });

  it("follows the editor back link when nothing else is open", () => {
    const root = document.createElement("div");
    root.innerHTML = `<a class="editor-back" href="#/pages">Back</a>`;
    window.location.hash = "#/content/home";

    expect(handleEscape(root)).toBe(true);
    expect(window.location.hash).toBe("#/pages");
  });

  it("clears library asset details before leaving the folder", () => {
    const root = document.createElement("div");
    root.innerHTML = `<section id="library-detail"><form id="asset-detail"></form></section>
      <nav class="editor-crumbs"><a href="#/library">Library</a> / <span>photos</span></nav>`;
    window.location.hash = "#/library/photos";

    expect(handleEscape(root)).toBe(true);
    expect(root.querySelector("#asset-detail")).toBeNull();
    expect(window.location.hash).toBe("#/library/photos");
  });
});

describe("libraryParentHash", () => {
  it("returns the parent folder link when browsing nested library paths", () => {
    const root = document.createElement("div");
    root.innerHTML = `<nav class="editor-crumbs">
        <a href="#/library">Library</a> /
        <a href="#/library/photos">photos</a> /
        <span>2024</span>
      </nav>`;
    window.location.hash = "#/library/photos/2024";

    expect(libraryParentHash(root)).toBe("#/library/photos");
  });
});
