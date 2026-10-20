// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bindCodeWrap,
  codeWrapClass,
  codeWrapToggle,
  isCodeWrapToggle,
  readCodeWrap,
  writeCodeWrap,
} from "./code-wrap.js";

const store = new Map<string, string>();

function stubStorage(): void {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  });
}

describe("code wrap", () => {
  beforeEach(() => {
    store.clear();
    stubStorage();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    store.clear();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("defaults off and persists the preference", () => {
    expect(readCodeWrap()).toBe(false);
    expect(codeWrapClass()).toBe("");
    writeCodeWrap(true);
    expect(readCodeWrap()).toBe(true);
    expect(codeWrapClass()).toBe(" editor-code-wrap");
    expect(codeWrapToggle("raw-file")).toContain('aria-controls="raw-file"');
    expect(codeWrapToggle("raw-file")).toContain("checked");
    expect(codeWrapToggle("raw-file")).not.toContain("name=");
  });

  it("toggles the class on YAML textareas without naming the checkbox", () => {
    document.body.innerHTML = `<form>
      ${codeWrapToggle("raw-file")}
      <textarea id="raw-file" class="editor-raw"></textarea>
    </form>`;
    const form = document.querySelector("form");
    if (!form) throw new Error("form");
    bindCodeWrap(form);
    const box = form.querySelector<HTMLInputElement>("[data-code-wrap]");
    const area = form.querySelector<HTMLTextAreaElement>("#raw-file");
    if (!box || !area) throw new Error("controls");
    expect(area.classList.contains("editor-code-wrap")).toBe(false);
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    expect(area.classList.contains("editor-code-wrap")).toBe(true);
    expect(readCodeWrap()).toBe(true);
    expect(isCodeWrapToggle(box)).toBe(true);
    expect(isCodeWrapToggle(area)).toBe(false);
  });

  it("survives a missing localStorage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readCodeWrap()).toBe(false);
    expect(() => writeCodeWrap(true)).not.toThrow();
  });
});
