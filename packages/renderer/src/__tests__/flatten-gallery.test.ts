import { describe, expect, it } from "vitest";
import { parseSiteDocument } from "@r-a-i-t-h/tessera-model";

/** Mirrors scripts/flatten-gallery.mjs fragment shape for Zod validation. */
describe("gallery flatten fragment", () => {
  it("parses media + gallery item + binding as a SiteDocument", () => {
    const fragment = {
      media: [
        {
          id: "sample-gallery-01-red",
          title: "Crimson field",
          caption: "Crimson field",
          url: "./media/sample-gallery/01-red.svg",
          type: "image" as const,
          alt: "Crimson field",
          sort: 1,
        },
      ],
      items: [
        {
          id: "sample-gallery-data",
          title: "Sample gallery (data)",
          tags: ["gallery"],
          zones: {
            slides: [{ type: "json" as const, data: ["sample-gallery-01-red"] }],
          },
        },
      ],
      bindings: [
        {
          id: "sample-gallery",
          component: "gallery",
          itemId: "sample-gallery-data",
          fromZone: "slides",
          props: { mode: "grid" },
        },
      ],
    };

    const doc = parseSiteDocument({
      version: 1,
      site: { id: "validate", title: "validate", homePageId: "home" },
      layouts: [{ id: "L", root: { type: "zone", id: "main" } }],
      pages: [
        {
          id: "home",
          title: "Home",
          layoutId: "L",
          zones: {
            main: [{ type: "text", html: "{{sample-gallery}}" }],
          },
        },
      ],
      ...fragment,
    });

    expect(doc.media[0]!.caption).toBe("Crimson field");
    expect(doc.bindings[0]!.id).toBe("sample-gallery");
    expect(doc.items[0]!.zones.slides?.[0]).toMatchObject({ type: "json" });
  });
});
