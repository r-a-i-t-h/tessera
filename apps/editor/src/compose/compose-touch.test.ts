// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { wireComposeTouchLayout } from "./compose-touch.js";

describe("wireComposeTouchLayout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets editor-compose--touch from the media query", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        media: "(pointer: coarse) and (max-width: 800px)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const form = document.createElement("form");
    form.innerHTML = `<div class="editor-compose-layout"></div>`;
    wireComposeTouchLayout(form);
    expect(form.querySelector(".editor-compose-layout")!.classList.contains("editor-compose--touch")).toBe(
      true,
    );

    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const form2 = document.createElement("form");
    form2.innerHTML = `<div class="editor-compose-layout"></div>`;
    wireComposeTouchLayout(form2);
    expect(form2.querySelector(".editor-compose-layout")!.classList.contains("editor-compose--touch")).toBe(
      false,
    );
  });
});
