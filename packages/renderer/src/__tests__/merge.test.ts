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
});
