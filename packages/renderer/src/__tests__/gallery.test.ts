import { describe, expect, it } from "vitest";
import { captionFromFilename } from "@r-a-i-t-h/tessera-model";
import {
  ComponentRegistry,
  gallery,
  slidesFromFolders,
  slidesFromImageBlocks,
} from "../index.js";
import type { RenderContext } from "../types.js";
import { makeFixtureDoc } from "./fixtures.js";

describe("captionFromFilename", () => {
  it("strips ordering prefix and extension", () => {
    expect(captionFromFilename("01-red.svg")).toBe("Red");
    expect(captionFromFilename("001_billy-goat.jpg")).toBe("Billy Goat");
  });
});

describe("slidesFromFolders", () => {
  it("merges folders and applies filter", () => {
    const doc = makeFixtureDoc();
    doc.folders = [
      {
        id: "a",
        path: "./media/a",
        images: [{ file: "01-one.svg" }, { file: "02-sale-two.svg" }],
      },
      {
        id: "b",
        path: "./media/b",
        images: [{ file: "01-three.svg", caption: "Custom" }],
      },
    ];
    const all = slidesFromFolders(doc, ["a", "b"]);
    expect(all.map((s) => s.caption)).toEqual(["One", "Sale Two", "Custom"]);
    expect(all[0]!.url).toBe("./media/a/01-one.svg");

    const filtered = slidesFromFolders(doc, ["a"], "sale-");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.file).toBe("02-sale-two.svg");
  });

  it("uses an explicit image url instead of joining the folder path", () => {
    const doc = makeFixtureDoc();
    doc.folders = [
      {
        id: "hall",
        path: "./media",
        images: [{ file: "porch.svg", url: "./media/porch.svg", caption: "The porch" }],
      },
    ];
    const slides = slidesFromFolders(doc, ["hall"]);
    expect(slides[0]!.url).toBe("./media/porch.svg");
    expect(slides[0]!.file).toBe("porch.svg");
  });
});

describe("slidesFromImageBlocks", () => {
  it("uses document order and explicit captions", () => {
    const slides = slidesFromImageBlocks([
      { type: "image", url: "./x/01-alpha.svg" },
      { type: "image", url: "./x/beta.svg", caption: "Beta explicit" },
    ]);
    expect(slides.map((s) => s.caption)).toEqual(["Alpha", "Beta explicit"]);
  });
});

describe("gallery component", () => {
  it("emits tessera-gallery from folder props", () => {
    const doc = makeFixtureDoc();
    doc.folders = [
      {
        id: "sample",
        path: "./media/sample",
        images: [{ file: "01-a.svg" }, { file: "02-b.svg" }],
      },
    ];
    const registry = new ComponentRegistry();
    registry.define("gallery", gallery);

    const ctx: RenderContext = {
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
      escapeHtml: (s) =>
        s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    };

    const html = gallery(ctx, { folders: ["sample"], mode: "grid" });
    expect(html).toContain("<tessera-gallery");
    expect(html).toContain("./media/sample/01-a.svg");
    expect(html).toContain("./media/sample/02-b.svg");
  });

  it("emits from inline image zone", () => {
    const doc = makeFixtureDoc();
    const registry = new ComponentRegistry();
    registry.define("gallery", gallery);
    const zones = new Map([
      [
        "slides",
        [
          { type: "image" as const, url: "./inline/01-x.svg" },
          { type: "image" as const, url: "./inline/02-y.svg", caption: "Y" },
        ],
      ],
    ]);
    const ctx: RenderContext = {
      document: doc,
      page: doc.pages[0]!,
      profile: {
        layoutId: doc.pages[0]!.layoutId ?? "with-aside",
        layoutSource: "page",
      },
      zones,
      registry,
      renderBlocks: () => "",
      zoneJson: () => [],
      mediaHtml: () => "",
      escapeHtml: (s) =>
        s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    };
    const html = gallery(ctx, { fromZone: "slides" });
    expect(html).toContain("./inline/01-x.svg");
    expect(html).toContain("Y");
  });
});
