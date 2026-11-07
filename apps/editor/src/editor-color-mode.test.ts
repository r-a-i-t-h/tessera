// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY,
  applyDarkMode,
  darkModeAppearanceBlock,
  readDarkMode,
  writeDarkMode,
} from "./editor-color-mode.js";

const modeStore = new Map<string, string>();

function stubModeStorage(): void {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => modeStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      modeStore.set(key, value);
    },
    removeItem: (key: string) => {
      modeStore.delete(key);
    },
    clear: () => {
      modeStore.clear();
    },
  });
}

describe("editor color mode", () => {
  beforeEach(() => {
    modeStore.clear();
    stubModeStorage();
  });

  afterEach(() => {
    document.documentElement.classList.remove("editor-dark");
    document.documentElement.style.colorScheme = "";
    document.body.className = "w3-light-grey";
    vi.unstubAllGlobals();
    modeStore.clear();
  });

  it("defaults to light", () => {
    expect(readDarkMode()).toBe(false);
  });

  it("persists dark preference", () => {
    writeDarkMode(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
    expect(readDarkMode()).toBe(true);
    writeDarkMode(false);
    expect(readDarkMode()).toBe(false);
  });

  it("applyDarkMode toggles html and body classes", () => {
    applyDarkMode(true);
    expect(document.documentElement.classList.contains("editor-dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.body.classList.contains("editor-body-dark")).toBe(true);
    expect(document.body.classList.contains("w3-light-grey")).toBe(false);

    applyDarkMode(false);
    expect(document.documentElement.classList.contains("editor-dark")).toBe(false);
    expect(document.body.classList.contains("w3-light-grey")).toBe(true);
  });

  it("appearance block contains the dark mode control", () => {
    expect(darkModeAppearanceBlock()).toContain("data-editor-dark-mode");
    expect(darkModeAppearanceBlock()).toContain("Appearance");
  });
});
