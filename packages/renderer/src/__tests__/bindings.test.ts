import { describe, expect, it } from "vitest";
import { ComponentRegistry, expandMustache, renderNamed } from "../index.js";
import type { RenderContext } from "../types.js";
import { makeFixtureDoc } from "./fixtures.js";

function stubCtx(overrides: Partial<RenderContext> = {}): RenderContext {
  const doc = makeFixtureDoc();
  doc.bindings = [
    {
      id: "farm-open-days",
      component: "greet",
      props: { name: "Open" },
    },
  ];
  const registry = new ComponentRegistry();
  registry.define("greet", (_c, props = {}) => `Hi ${String(props.name ?? "")}`);
  return {
    document: doc,
    page: doc.pages[0]!,
    profile: {
      layoutId: "with-aside",
      layoutSource: "site",
    },
    zones: new Map(),
    registry,
    renderBlocks: () => "",
    mediaHtml: () => "",
    escapeHtml: (s) => s,
    ...overrides,
  };
}

describe("site-data bindings", () => {
  it("resolves component name via document bindings", () => {
    const ctx = stubCtx();
    expect(renderNamed("farm-open-days", ctx)).toBe("Hi Open");
  });

  it("expands mustache placeholders in text", () => {
    const ctx = stubCtx();
    const html = expandMustache("<p>Open:</p>{{farm-open-days}}", ctx);
    expect(html).toBe("<p>Open:</p>Hi Open");
  });

  it("leaves a comment for unknown mustache ids", () => {
    const ctx = stubCtx();
    expect(expandMustache("{{missing}}", ctx)).toContain("unknown binding: missing");
  });
});
