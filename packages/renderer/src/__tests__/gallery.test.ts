import { describe, expect, it } from "vitest";
import { ComponentRegistry, gallery, resolveGalleryMediaIds } from "../index.js";
import type { RenderContext } from "../types.js";
import { makeFixtureDoc } from "./fixtures.js";

describe("resolveGalleryMediaIds", () => {
  it("accepts string ids", () => {
    expect(resolveGalleryMediaIds(["a", "b"])).toEqual(["a", "b"]);
  });

  it("accepts { id } rows", () => {
    expect(resolveGalleryMediaIds([{ id: "a" }, { id: "b" }])).toEqual(["a", "b"]);
  });

  it("accepts { mediaIds }", () => {
    expect(resolveGalleryMediaIds([{ mediaIds: ["x", "y"] }])).toEqual(["x", "y"]);
  });
});

describe("gallery component", () => {
  it("emits tessera-gallery with catalog urls", () => {
    const doc = makeFixtureDoc();
    doc.media = [
      { id: "g1", url: "./media/a.svg", caption: "A", sort: 1 },
      { id: "g2", url: "./media/b.svg", caption: "B", sort: 2 },
    ];
    const registry = new ComponentRegistry();
    registry.define("gallery", gallery);

    const zones = new Map([
      [
        "slides",
        [{ type: "json" as const, data: ["g1", "g2"] }],
      ],
    ]);

    const ctx: RenderContext = {
      document: doc,
      page: doc.pages[0]!,
      zones,
      registry,
      renderBlocks: () => "",
      zoneJson: <T = unknown>(zoneId: string) => {
        const blocks = zones.get(zoneId) ?? [];
        const out: unknown[] = [];
        for (const b of blocks) {
          if (b.type !== "json") continue;
          if (Array.isArray(b.data)) out.push(...b.data);
          else out.push(b.data);
        }
        return out as T[];
      },
      mediaHtml: () => "",
      escapeHtml: (s) =>
        s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    };

    const html = gallery(ctx, { fromZone: "slides", mode: "grid" });
    expect(html).toContain("<tessera-gallery");
    expect(html).toContain("mode=\"grid\"");
    expect(html).toContain("./media/a.svg");
    expect(html).toContain("./media/b.svg");
  });
});
