import { describe, expect, it } from "vitest";
import {
  parseSiteDocument,
  safeParseSiteDocument,
  collectDeclaredZones,
  captionFromFilename,
} from "../index.js";
import type { LayoutNode } from "../index.js";

describe("SiteDocument schema", () => {
  it("parses a valid document", () => {
    const doc = parseSiteDocument({
      version: 2,
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
      version: 99,
      site: { id: "s", title: "S", homePageId: "p1" },
      layouts: [{ id: "L", root: { type: "static", html: "x" } }],
      pages: [{ id: "p1", title: "P", layoutId: "L", zones: {} }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts media caption and sort", () => {
    const doc = parseSiteDocument({
      version: 2,
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

  it("parses folders and derives captionFromFilename", () => {
    const doc = parseSiteDocument({
      version: 2,
      site: { id: "s", title: "S", homePageId: "p1" },
      layouts: [{ id: "L", root: { type: "zone", id: "main" } }],
      pages: [{ id: "p1", title: "P", layoutId: "L", zones: {} }],
      folders: [
        {
          id: "g",
          path: "./media/g",
          images: [{ file: "01-hello-world.svg" }],
        },
      ],
    });
    expect(doc.folders[0]!.images[0]!.file).toBe("01-hello-world.svg");
    expect(captionFromFilename("01-hello-world.svg")).toBe("Hello World");
  });

  it("parses site-defined types", () => {
    const doc = parseSiteDocument({
      version: 2,
      site: { id: "s", title: "S", homePageId: "p1", defaultLayoutId: "L" },
      layouts: [
        {
          id: "L",
          root: {
            type: "region",
            children: [{ type: "zone", id: "main" }],
          },
        },
      ],
      pages: [{ id: "p1", title: "P", type: "event", fields: { date: "2026-10-18" }, zones: {} }],
      types: [
        {
          id: "event",
          layoutId: "L",
          fields: [{ id: "date", required: true }],
        },
      ],
    });
    expect(doc.types[0]!.id).toBe("event");
    expect(doc.pages[0]!.type).toBe("event");
    expect(doc.pages[0]!.fields?.date).toBe("2026-10-18");
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
