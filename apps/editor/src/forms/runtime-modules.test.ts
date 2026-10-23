// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../maximized-code-editor.js", () => ({
  mountMaximizedCodeEditor: vi.fn(() => ({
    focus: vi.fn(),
    destroy: vi.fn(),
  })),
}));

import {
  bindRuntimeModuleEditor,
  bindRuntimeModuleUpload,
  renderRuntimeModuleDetail,
  renderRuntimeModulePage,
  renderRuntimeModulesList,
  runtimeModulesRouteHash,
} from "./runtime-modules.js";

describe("runtime module editor", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders a page title, pages-style list, and upload panel on the right", () => {
    const html = renderRuntimeModulesList([
      { id: "demo", url: "./runtime-modules/demo.mjs", ext: "mjs", title: "Demo" },
      { id: "other", url: "./runtime-modules/other.js", ext: "js" },
    ]);
    expect(html).toContain('<h1 class="w3-large">Runtime modules</h1>');
    expect(html).not.toContain("editor-toolbar");
    expect(html).toContain('id="runtime-module-list"');
    expect(html).toContain("editor-library-split");
    expect(html).toContain("data-runtime-upload");
    expect(html).toContain("multiple");
  });

  it("renders a toolbar with back, save, and delete on the module page", () => {
    const html = renderRuntimeModulePage(
      { id: "demo", url: "./runtime-modules/demo.mjs", ext: "mjs", title: "Demo" },
      "export default function mount() {}",
      "demo-copy",
    );
    expect(html).toContain('editor-back" href="#/records/runtimeModules"');
    expect(runtimeModulesRouteHash("demo")).toBe("#/records/runtimeModules/demo");
    expect(html).toContain('form="runtime-module-form"');
    expect(html).toContain("data-runtime-delete");
    expect(html).not.toContain("editor-library-split");
    expect(html).toContain("Duplicate as");
    expect(html).toContain('data-action="duplicate-runtime-module"');
  });

  it("uploads files chosen in the form", async () => {
    const uploaded: File[] = [];
    document.body.innerHTML = renderRuntimeModulesList([]);
    bindRuntimeModuleUpload(document.body, (files) => {
      uploaded.push(...files);
    });
    const form = document.querySelector<HTMLFormElement>("[data-runtime-upload]")!;
    const input = form.querySelector<HTMLInputElement>('input[name="file"]')!;
    const file = new File(['export default function mount() {}'], "a.mjs", { type: "text/javascript" });
    Object.defineProperty(input, "files", { value: [file] });
    form.requestSubmit();
    await Promise.resolve();
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]?.name).toBe("a.mjs");
  });

  it("renders maximize and normalize controls beside the raw editor", () => {
    const html = renderRuntimeModuleDetail(
      { id: "demo", url: "./runtime-modules/demo.mjs", ext: "mjs", title: "Demo" },
      "export default function mount() {}",
    );
    expect(html).toContain("data-runtime-maximize>Maximize</button>");
    expect(html).toContain('class="w3-button w3-white runtime-module-normalize" data-runtime-normalize');
    expect(html).toContain('name="title"');
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
