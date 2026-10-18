import { describe, expect, it } from "vitest";
import {
  ComponentRegistry,
  autopositionRects,
  imageRevealGallery,
  resolveItemRects,
  type ImageRevealItem,
} from "../index.js";
import type { RenderContext } from "../types.js";
import { makeFixtureDoc } from "./fixtures.js";

describe("autopositionRects", () => {
  it("spaces three tiles on a 700x300 stage", () => {
    const rects = autopositionRects(3, 700, 300, 180, 180);
    expect(rects).toHaveLength(3);
    expect(rects[0]).toEqual({ left: 40, top: 60, width: 180, height: 180 });
    expect(rects[1]?.left).toBe(260);
    expect(rects[2]?.left).toBe(480);
  });
});

describe("resolveItemRects", () => {
  it("uses manual rects when every item has layout", () => {
    const items: ImageRevealItem[] = [
      { id: "a", url: "./a.jpg", href: "a", rect: { left: 1, top: 2, width: 3, height: 4 } },
      { id: "b", url: "./b.jpg", href: "b", rect: { left: 5, top: 6, width: 7, height: 8 } },
    ];
    expect(resolveItemRects(items, 700, 300, true)).toEqual([
      { left: 1, top: 2, width: 3, height: 4 },
      { left: 5, top: 6, width: 7, height: 8 },
    ]);
  });

  it("autopositions when any item lacks layout", () => {
    const items: ImageRevealItem[] = [
      { id: "a", url: "./a.jpg", href: "a" },
      { id: "b", url: "./b.jpg", href: "b" },
    ];
    const rects = resolveItemRects(items, 700, 300, true);
    expect(rects).toHaveLength(2);
    expect(rects[0]?.width).toBeGreaterThan(0);
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
      items: [
        {
          url: "./media/hero/img1.jpg",
          href: "mobile-farm",
          alt: "Mobile farm",
          left: 40,
          top: 60,
          width: 180,
          height: 180,
        },
      ],
    });

    expect(html).toContain("<tessera-image-reveal-gallery");
    expect(html).toContain('width="700"');
    expect(html).toContain('height="300"');
    expect(html).toContain("./media/hero/img1.jpg");
    expect(html).toContain("/pages/mobile-farm.html");
    expect(html).toContain("Mobile farm");
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
