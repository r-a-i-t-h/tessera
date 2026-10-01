import { describe, expect, it } from "vitest";
import { parseSiteDocument, resolvePageProfile } from "../index.js";

function baseDoc() {
  return parseSiteDocument({
    version: 2,
    site: {
      id: "s",
      title: "S",
      homePageId: "home",
      defaultLayoutId: "standard",
    },
    layouts: [
      { id: "standard", root: { type: "zone", id: "main" } },
      { id: "article", root: { type: "zone", id: "main" } },
    ],
    pages: [
      { id: "home", title: "Home", zones: {} },
      { id: "event-farm", title: "Farm", type: "event", zones: {} },
      { id: "note", title: "Note", type: "loose", zones: {} },
    ],
    types: [
      { id: "event", layoutId: "article", fields: [{ id: "date", required: true }, { id: "precis" }] },
      { id: "loose", fields: [] },
    ],
  });
}

describe("resolvePageProfile", () => {
  it("uses the type layout", () => {
    const doc = baseDoc();
    const page = doc.pages.find((p) => p.id === "event-farm")!;
    expect(resolvePageProfile(doc, page)).toMatchObject({
      layoutId: "article",
      layoutSource: "type",
      typeId: "event",
    });
  });

  it("uses the site default when the type names no layout", () => {
    const doc = baseDoc();
    const page = doc.pages.find((p) => p.id === "note")!;
    expect(resolvePageProfile(doc, page)).toMatchObject({
      layoutId: "standard",
      layoutSource: "site",
      typeId: "loose",
    });
  });

  it("uses the site default for a page with no type", () => {
    const doc = baseDoc();
    const page = doc.pages.find((p) => p.id === "home")!;
    const profile = resolvePageProfile(doc, page);
    expect(profile).toMatchObject({
      layoutId: "standard",
      layoutSource: "site",
    });
    expect(profile.typeId).toBeUndefined();
  });

  it("falls back to the first layout when the site has no default", () => {
    const lonely = parseSiteDocument({
      version: 2,
      site: { id: "s", title: "S", homePageId: "lonely" },
      layouts: [{ id: "standard", root: { type: "zone", id: "main" } }],
      pages: [{ id: "lonely", title: "Lonely", zones: {} }],
      types: [],
    });
    expect(resolvePageProfile(lonely, lonely.pages[0]!)).toMatchObject({
      layoutId: "standard",
      layoutSource: "site",
    });
  });
});
