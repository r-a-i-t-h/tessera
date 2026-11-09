// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY,
  applyDarkMode,
  bindDarkMode,
  darkModeLoginToggle,
  darkModeSidebarToggle,
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

  it("sidebar toggle is an icon button with moon when light", () => {
    expect(darkModeSidebarToggle()).toContain("data-editor-dark-mode");
    expect(darkModeSidebarToggle()).toContain('aria-pressed="false"');
    expect(darkModeSidebarToggle()).toContain("Switch to dark mode");
    expect(darkModeSidebarToggle()).toContain("editor-dark-mode-icon");
  });

  it("sidebar toggle shows sun when dark", () => {
    writeDarkMode(true);
    expect(darkModeSidebarToggle()).toContain('aria-pressed="true"');
    expect(darkModeSidebarToggle()).toContain("Switch to light mode");
  });

  it("login toggle uses the login modifier class", () => {
    expect(darkModeLoginToggle()).toContain("editor-dark-mode-toggle--login");
    expect(darkModeLoginToggle()).toContain("data-editor-dark-mode");
  });

  it("bindDarkMode flips preference on click", () => {
    const host = document.createElement("div");
    host.innerHTML = darkModeSidebarToggle();
    document.body.append(host);
    bindDarkMode(host);
    host.querySelector<HTMLButtonElement>("[data-editor-dark-mode]")?.click();
    expect(readDarkMode()).toBe(true);
    expect(document.documentElement.classList.contains("editor-dark")).toBe(true);
    host.querySelector<HTMLButtonElement>("[data-editor-dark-mode]")?.click();
    expect(readDarkMode()).toBe(false);
  });
});
