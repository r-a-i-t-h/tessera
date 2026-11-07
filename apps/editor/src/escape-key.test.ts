/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it, vi } from "vitest";
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
    root.innerHTML = `<form id="new-binding-form" class="editor-new-page">
        <button type="button" data-binding-step="back">Back</button>
      </form>`;
    let clicks = 0;
    root.querySelector("[data-binding-step=back]")?.addEventListener("click", () => {
      clicks += 1;
    });

    expect(handleEscape(root)).toBe(true);
    expect(clicks).toBe(1);
  });

  it("cancels dataset grid edit before navigating back", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" data-dataset-cancel-grid>Cancel</button>
      <a class="editor-back" href="#/data">Back</a>`;
    let cancelled = false;
    root.querySelector("[data-dataset-cancel-grid]")?.addEventListener("click", () => {
      cancelled = true;
    });
    window.location.hash = "#/data/meetings";

    expect(handleEscape(root)).toBe(true);
    expect(cancelled).toBe(true);
    expect(window.location.hash).toBe("#/data/meetings");
  });

  it("follows the editor back link when nothing else is open", () => {
    const root = document.createElement("div");
    root.innerHTML = `<a class="editor-back" href="#/pages">Back</a>`;
    window.location.hash = "#/content/home";

    expect(handleEscape(root)).toBe(true);
    expect(window.location.hash).toBe("#/pages");
  });

  it("confirms before back when the record form is dirty", () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const root = document.createElement("div");
    root.innerHTML = `<form id="record-form" data-dirty="true"></form>
      <a class="editor-back" href="#/pages">Back</a>`;
    window.location.hash = "#/content/home";

    expect(handleEscape(root)).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();
    expect(window.location.hash).toBe("#/content/home");
    vi.unstubAllGlobals();
  });

  it("navigates back when dirty confirm is accepted", () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const root = document.createElement("div");
    root.innerHTML = `<form id="record-form" data-dirty="true"></form>
      <a class="editor-back" href="#/pages">Back</a>`;
    window.location.hash = "#/content/home";

    expect(handleEscape(root)).toBe(true);
    expect(window.location.hash).toBe("#/pages");
    vi.unstubAllGlobals();
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

  it("clears library folder details", () => {
    const root = document.createElement("div");
    root.innerHTML = `<section id="library-detail"><form id="folder-detail"></form></section>`;

    expect(handleEscape(root)).toBe(true);
    expect(root.querySelector("#folder-detail")).toBeNull();
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
