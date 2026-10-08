import { describe, expect, it } from "vitest";
import { mergeZones, indexDocument } from "../merge.js";
import { makeFixtureDoc } from "./fixtures.js";

describe("mergeZones", () => {
  it("merges page zones then includes in order", () => {
    const doc = makeFixtureDoc();
    const { itemsById } = indexDocument(doc);
    const page = doc.pages.find((p) => p.id === "home")!;
    const zones = mergeZones(doc, page, itemsById);

    const aside = zones.get("aside") ?? [];
    expect(aside.map((b) => (b.type === "text" ? b.html : ""))).toEqual([
      "<p>Page aside</p>",
      "<p>Promo aside</p>",
    ]);

    expect(zones.get("footer")?.[0]).toMatchObject({
      type: "text",
      html: "<p>Shared footer</p>",
    });
  });

  it("skips missing include ids", () => {
    const doc = makeFixtureDoc();
    const { itemsById } = indexDocument(doc);
    const page = {
      ...doc.pages[0]!,
      includes: ["shared-footer", "does-not-exist"],
    };
    const zones = mergeZones(doc, page, itemsById);
    expect(zones.get("footer")).toHaveLength(1);
  });

  it("appends page-layout then master includes and concatenates a shared zone", () => {
    const doc = makeFixtureDoc();
    doc.items.push(
      { id: "page-banner", zones: { header: [{ type: "text", html: "From page layout" }] } },
      { id: "site-header", zones: { header: [{ type: "text", html: "From master" }] } },
    );
    doc.layouts[0]!.includes = ["page-banner"];
    doc.site.masterLayoutId = "master";
    doc.layouts.push({
      id: "master",
      includes: ["site-header", "shared-footer", "missing-item"],
      root: {
        type: "region",
        children: [{ type: "zone", id: "header" }, { type: "page" }],
      },
    });
    const page = doc.pages.find((item) => item.id === "about")!;
    page.zones.header = [{ type: "text", html: "From page" }];
    const zones = mergeZones(doc, page, indexDocument(doc).itemsById);

    expect((zones.get("header") ?? []).map((block) => (block.type === "text" ? block.html : ""))).toEqual([
      "From page",
      "From page layout",
      "From master",
    ]);
    expect(zones.get("footer")).toHaveLength(1);
    expect(zones.get("footer")?.[0]).toMatchObject({ type: "text", html: "<p>Shared footer</p>" });
  });

  it("applies a frame include once when the page layout is that frame", () => {
    const doc = makeFixtureDoc();
    doc.items.push({ id: "site-header", zones: { header: [{ type: "text", html: "Once" }] } });
    doc.layouts.push({
      id: "frame",
      includes: ["site-header", "site-header"],
      root: {
        type: "region",
        children: [{ type: "zone", id: "header" }, { type: "page" }],
      },
    });
    doc.site.defaultLayoutId = "frame";
    doc.site.masterLayoutId = "frame";
    const page = doc.pages.find((item) => item.id === "about")!;
    const zones = mergeZones(doc, page, indexDocument(doc).itemsById);
    expect(zones.get("header")).toHaveLength(1);
  });
});
