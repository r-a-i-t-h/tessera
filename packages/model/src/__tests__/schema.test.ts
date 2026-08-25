import { describe, expect, it } from "vitest";
import { parseSiteDocument, safeParseSiteDocument, collectDeclaredZones } from "../index.js";
import type { LayoutNode } from "../index.js";

describe("SiteDocument schema", () => {
  it("parses a valid document", () => {
    const doc = parseSiteDocument({
      version: 1,
      site: { id: "s", title: "S", homePageId: "p1" },
      layouts: [
        {
          id: "L",
          root: {
            type: "region",
            children: [{ type: "zone", id: "main" }],
          },
        },
      ],
      pages: [
        {
          id: "p1",
          title: "P",
          layoutId: "L",
          zones: { main: [{ type: "text", html: "hi" }] },
        },
      ],
    });
    expect(doc.pages[0]!.id).toBe("p1");
  });

  it("rejects invalid version", () => {
    const result = safeParseSiteDocument({
      version: 2,
      site: { id: "s", title: "S", homePageId: "p1" },
      layouts: [{ id: "L", root: { type: "static", html: "x" } }],
      pages: [{ id: "p1", title: "P", layoutId: "L", zones: {} }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts media caption and sort", () => {
    const doc = parseSiteDocument({
      version: 1,
      site: { id: "s", title: "S", homePageId: "p1" },
      layouts: [
        {
          id: "L",
          root: {
            type: "region",
            children: [{ type: "zone", id: "main" }],
          },
        },
      ],
      pages: [
        {
          id: "p1",
          title: "P",
          layoutId: "L",
          zones: { main: [{ type: "text", html: "hi" }] },
        },
      ],
      media: [
        {
          id: "m1",
          url: "./a.svg",
          caption: "Cap",
          sort: 3,
        },
      ],
    });
    expect(doc.media[0]!.caption).toBe("Cap");
    expect(doc.media[0]!.sort).toBe(3);
  });

  it("collectDeclaredZones walks the layout tree", () => {
    const root: LayoutNode = {
      type: "region",
      children: [
        { type: "zone", id: "title" },
        {
          type: "component",
          name: "shell",
          children: [{ type: "zone", id: "main" }],
        },
      ],
    };
    expect([...collectDeclaredZones(root)].sort()).toEqual(["main", "title"]);
  });
});
