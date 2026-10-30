import { describe, expect, it } from "vitest";
import { ComponentRegistry, escapeHtml, type RenderContext } from "@r-a-i-t-h/tessera-renderer";
import { parseSiteDocument } from "@r-a-i-t-h/tessera-model";
import { runtimeModule } from "./runtime-module-present.js";
import { isValidRuntimeModulePublicUrl } from "./runtime-module-url.js";
import { registerExtras } from "./index.js";

describe("runtimeModule", () => {
  it("emits mount markup with validated module URL", () => {
    const registry = new ComponentRegistry();
    registerExtras((name, fn) => registry.define(name, fn));
    const doc = parseSiteDocument({
      version: 2,
      site: { id: "t", title: "T", homePageId: "home" },
      layouts: [{ id: "l", root: { type: "region", children: [{ type: "page" }] } }],
      pages: [{ id: "home", title: "Home", zones: {} }],
      runtimeModules: [{ id: "demo", url: "./runtime-modules/demo.mjs", title: "Demo" }],
    });
    const ctx = {
      document: doc,
      page: doc.pages[0]!,
      profile: { layoutId: "l", layoutSource: "site" },
      zones: new Map(),
      registry,
      renderBlocks: () => "",
      mediaHtml: () => "",
      escapeHtml,
    } satisfies RenderContext;
    const html = runtimeModule(ctx, { module: "demo" });
    expect(html).toContain("tessera-runtime-module-mount");
    expect(html).toContain("./runtime-modules/demo.mjs");
    expect(html).toContain('"v":1');
  });

  it("validates public URLs", () => {
    expect(isValidRuntimeModulePublicUrl("./runtime-modules/a.mjs")).toBe(true);
    expect(isValidRuntimeModulePublicUrl("https://evil/x.js")).toBe(false);
  });
});
