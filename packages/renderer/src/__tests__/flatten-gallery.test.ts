import { describe, expect, it } from "vitest";
import { parseSiteDocument } from "@r-a-i-t-h/tessera-model";

describe("gallery folder fragment", () => {
  it("parses folders + folder-sourced binding", () => {
    const doc = parseSiteDocument({
      version: 2,
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
      folders: [
        {
          id: "sample-gallery",
          path: "./media/sample-gallery",
          images: [
            { file: "01-red.svg" },
            { file: "02-amber.svg", caption: "Amber field" },
          ],
        },
      ],
      bindings: [
        {
          id: "sample-gallery",
          component: "gallery",
          props: { folders: ["sample-gallery"], mode: "grid" },
        },
      ],
    });

    expect(doc.folders[0]!.images).toHaveLength(2);
    expect(doc.bindings[0]!.props).toMatchObject({ folders: ["sample-gallery"] });
  });

  it("parses image blocks in a layout-declared zone", () => {
    const doc = parseSiteDocument({
      version: 2,
      site: { id: "validate", title: "validate", homePageId: "home" },
      layouts: [{ id: "L", root: { type: "zone", id: "slides" } }],
      pages: [
        {
          id: "home",
          title: "Home",
          layoutId: "L",
          zones: {
            slides: [
              { type: "image", url: "./a.svg", caption: "A" },
              { type: "image", url: "./b.svg" },
            ],
          },
        },
      ],
    });
    expect(doc.pages[0]!.zones.slides).toHaveLength(2);
  });
});
