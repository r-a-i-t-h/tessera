import { describe, expect, it } from "vitest";
import { ComponentRegistry, expandMustache, renderNamed } from "../index.js";
import type { RenderContext } from "../types.js";
import { makeFixtureDoc } from "./fixtures.js";

function stubCtx(overrides: Partial<RenderContext> = {}): RenderContext {
  const doc = makeFixtureDoc();
  doc.bindings = [
    {
      id: "farm-open-days",
      component: "eventList",
      itemId: "open-days-data",
      fromZone: "events",
      props: { limit: 2 },
    },
  ];
  doc.items.push({
    id: "open-days-data",
    zones: {
      events: [
        {
          type: "json",
          data: [
            { title: "Day A" },
            { title: "Day B" },
            { title: "Day C" },
          ],
        },
      ],
    },
  });
  const registry = new ComponentRegistry();
  registry.define("eventList", (c, props = {}) => {
    const fromZone = String(props.fromZone ?? "events");
    const limit = typeof props.limit === "number" ? props.limit : undefined;
    let rows = c.zoneJson<{ title?: string }>(fromZone);
    if (limit !== undefined) rows = rows.slice(0, limit);
    return rows.map((r) => r.title).join(",");
  });
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
    ...overrides,
  };
}

describe("site-data bindings", () => {
  it("resolves component name via document bindings", () => {
    const ctx = stubCtx();
    expect(renderNamed("farm-open-days", ctx)).toBe("Day A,Day B");
  });

  it("expands mustache placeholders in text", () => {
    const ctx = stubCtx();
    const html = expandMustache("<p>Open:</p>{{farm-open-days}}", ctx);
    expect(html).toBe("<p>Open:</p>Day A,Day B");
  });

  it("leaves a comment for unknown mustache ids", () => {
    const ctx = stubCtx();
    expect(expandMustache("{{missing}}", ctx)).toContain("unknown binding: missing");
  });
});
