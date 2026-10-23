// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import { bindRuntimeModuleEditor, renderRuntimeModuleDetail } from "./runtime-modules.js";

describe("runtime module editor", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders maximize and normalize controls beside the raw editor", () => {
    const html = renderRuntimeModuleDetail(
      { id: "demo", url: "./runtime-modules/demo.mjs", ext: "mjs", title: "Demo" },
      "export default function mount() {}",
    );
    expect(html).toContain("data-runtime-maximize>Maximize</button>");
    expect(html).toContain('class="w3-button w3-white runtime-module-normalize" data-runtime-normalize');
  });

  it("toggles maximize overlay and restores on normalize", () => {
    document.body.innerHTML = renderRuntimeModuleDetail(
      { id: "demo", url: "./runtime-modules/demo.mjs", ext: "mjs", title: "Demo" },
      "export default function mount() {}",
    );
    const editor = document.querySelector<HTMLElement>(".runtime-module-editor")!;
    const form = document.querySelector<HTMLFormElement>("[data-runtime-raw]")!;
    const maximize = form.querySelector<HTMLButtonElement>("[data-runtime-maximize]")!;
    const normalize = form.querySelector<HTMLButtonElement>("[data-runtime-normalize]")!;
    bindRuntimeModuleEditor(document.body);

    expect(editor.classList.contains("runtime-module-editor--maximized")).toBe(false);

    maximize.click();
    expect(editor.classList.contains("runtime-module-editor--maximized")).toBe(true);
    expect(form.getAttribute("role")).toBe("dialog");
    expect(document.querySelector(".runtime-module-overlay-host")).not.toBeNull();

    normalize.click();
    expect(editor.classList.contains("runtime-module-editor--maximized")).toBe(false);
    expect(form.hasAttribute("role")).toBe(false);
    expect(document.querySelector(".runtime-module-overlay-host")).toBeNull();
    expect(editor.contains(form)).toBe(true);
  });
});
