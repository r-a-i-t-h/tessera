import { describe, expect, it } from "vitest";
import { ComponentRegistry } from "../registry.js";
import type { RenderContext } from "../types.js";
import { makeFixtureDoc } from "./fixtures.js";

function minimalCtx(registry: ComponentRegistry): RenderContext {
  const doc = makeFixtureDoc();
  return {
    document: doc,
    page: doc.pages[0]!,
    profile: {
      layoutId: doc.pages[0]!.layoutId ?? "with-aside",
      layoutSource: "page",
    },
    zones: new Map(),
    registry,
    renderBlocks: () => "",
    zoneJson: () => [],
    mediaHtml: () => "",
    escapeHtml: (s) => s,
  };
}

describe("ComponentRegistry", () => {
  it("renders registered functions with props", () => {
    const registry = new ComponentRegistry();
    registry.define("box", (_ctx, props = {}) => `<b>${String(props.label ?? "")}</b>`);
    expect(registry.render("box", minimalCtx(registry), { label: "X" })).toBe("<b>X</b>");
  });

  it("renders custom elements via defineElement", () => {
    const registry = new ComponentRegistry();
    registry.defineElement("card", "rt-card");
    const html = registry.render("card", minimalCtx(registry), { title: 'A "B"' }, "<p>in</p>");
    expect(html).toBe('<rt-card title="A &quot;B&quot;"><p>in</p></rt-card>');
  });

  it("comments unknown components", () => {
    const registry = new ComponentRegistry();
    expect(registry.render("missing", minimalCtx(registry))).toContain("unknown component");
  });
});
