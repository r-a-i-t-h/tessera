import { describe, expect, it } from "vitest";
import {
  ComponentRegistry,
  gridPanelRects,
  imageRevealGallery,
  resolveItemRects,
  type ImageRevealItem,
} from "../index.js";
import type { RenderContext } from "../types.js";
import { makeFixtureDoc } from "./fixtures.js";

describe("gridPanelRects", () => {
  it("places three panels in one row when ppr is 3", () => {
    const rects = gridPanelRects(3, 700, 300, 3);
    expect(rects).toHaveLength(3);
    expect(rects[0]).toEqual({ left: 0, top: 0, width: 234, height: 300 });
    expect(rects[1]).toEqual({ left: 234, top: 0, width: 233, height: 300 });
    expect(rects[2]).toEqual({ left: 467, top: 0, width: 233, height: 300 });
  });

  it("reserves a fourth slot when n=3 and ppr=4", () => {
    const rects = gridPanelRects(3, 700, 300, 4);
    expect(rects).toHaveLength(3);
    expect(rects[0]?.width).toBe(175);
    expect(rects[2]?.left).toBe(350);
    expect(rects.every((r) => r.height === 300)).toBe(true);
  });

  it("wraps four panels with ppr=3", () => {
    const rects = gridPanelRects(4, 700, 300, 3);
    expect(rects).toHaveLength(4);
    expect(rects[3]).toEqual({ left: 0, top: 150, width: 234, height: 150 });
  });

  it("builds six panels in three rows when ppr=2", () => {
    const rects = gridPanelRects(6, 700, 300, 2);
    expect(rects).toHaveLength(6);
    expect(rects[0]?.width).toBe(350);
    expect(rects[5]?.top).toBe(200);
  });
});

describe("resolveItemRects", () => {
  it("grids items by panels per row", () => {
    const items: ImageRevealItem[] = [
      { id: "a", url: "./a.jpg", href: "a" },
      { id: "b", url: "./b.jpg", href: "b" },
    ];
    const rects = resolveItemRects(items, 700, 300, 2);
    expect(rects).toHaveLength(2);
    expect(rects[0]?.width).toBe(350);
    expect(rects[1]?.left).toBe(350);
  });
});

describe("imageRevealGallery component", () => {
  it("emits tessera-image-reveal-gallery with resolved assets and hrefs", () => {
    const doc = makeFixtureDoc();
    const registry = new ComponentRegistry();
    registry.define("imageRevealGallery", imageRevealGallery);

    const ctx: RenderContext = {
      document: doc,
      page: doc.pages[0]!,
      profile: {
        layoutId: "with-aside",
        layoutSource: "site",
      },
      zones: new Map(),
      registry,
      renderBlocks: () => "",
      zoneJson: () => [],
      mediaHtml: () => "",
      pageHref: (id) => `/pages/${id}.html`,
      escapeHtml: (s) =>
        s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    };

    const html = imageRevealGallery(ctx, {
      width: 700,
      height: 300,
      panelsPerRow: 3,
      items: [
        {
          url: "./media/hero/img1.jpg",
          href: "mobile-farm",
          title: "Mobile farm",
        },
      ],
    });

    expect(html).toContain("<tessera-image-reveal-gallery");
    expect(html).toContain('width="700"');
    expect(html).toContain('height="300"');
    expect(html).toContain('panels-per-row="3"');
    expect(html).toContain("./media/hero/img1.jpg");
    expect(html).toContain("/pages/mobile-farm.html");
    expect(html).toContain("Mobile farm");
    expect(html).not.toContain("layout=");
  });

  it("returns empty message when no items", () => {
    const doc = makeFixtureDoc();
    const ctx: RenderContext = {
      document: doc,
      page: doc.pages[0]!,
      profile: { layoutId: "with-aside", layoutSource: "site" },
      zones: new Map(),
      registry: new ComponentRegistry(),
      renderBlocks: () => "",
      zoneJson: () => [],
      mediaHtml: () => "",
      escapeHtml: (s) => s,
    };
    expect(imageRevealGallery(ctx, { items: [] })).toContain("No reveal banner panels");
  });
});

describe("default registry", () => {
  it("registers imageRevealGallery", async () => {
    const { createDefaultRegistry } = await import("../default-registry.js");
    const registry = createDefaultRegistry();
    expect(registry.has("imageRevealGallery")).toBe(true);
  });
});
