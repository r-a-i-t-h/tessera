import { describe, expect, it } from "vitest";
import { aspectClassName, parseSiteDocument, resolveAspect } from "../index.js";

function doc() {
  return parseSiteDocument({
    version: 2,
    site: {
      id: "s",
      title: "S",
      homePageId: "home",
      masterLayoutId: "master",
      defaultLayoutId: "page",
      aspects: [
        { id: "summer", label: "Summer" },
        { id: "night", label: "Night" },
      ],
      defaultAspectId: "summer",
    },
    layouts: [
      {
        id: "master",
        root: { type: "region", children: [{ type: "page" }] },
      },
      { id: "page", root: { type: "zone", id: "main" } },
    ],
    pages: [
      { id: "home", title: "Home", parentId: "events", zones: {} },
      { id: "events", title: "Events", parentId: "home", aspectId: "night", zones: {} },
      { id: "fair", title: "Fair", parentId: "events", zones: {} },
      { id: "stall", title: "Stall", parentId: "fair", zones: {} },
      { id: "archive", title: "Archive", parentId: "events", aspectId: "summer", zones: {} },
      { id: "old-fair", title: "Old fair", parentId: "archive", zones: {} },
      { id: "about", title: "About", zones: {} },
    ],
  });
}

describe("resolveAspect", () => {
  it("uses the nearest ancestor and ignores the home page parent", () => {
    const document = doc();
    const page = (id: string) => document.pages.find((item) => item.id === id)!;

    expect(resolveAspect(document, page("events"))).toEqual({
      aspectId: "night",
      source: "page",
      fromPageId: "events",
    });
    expect(resolveAspect(document, page("stall"))).toEqual({
      aspectId: "night",
      source: "ancestor",
      fromPageId: "events",
    });
    expect(resolveAspect(document, page("home"))).toEqual({
      aspectId: "summer",
      source: "site",
    });
    expect(resolveAspect(document, page("about"))).toEqual({
      aspectId: "summer",
      source: "site",
    });
  });

  it("lets a nested page name an aspect and reset its descendants", () => {
    const document = doc();
    const page = (id: string) => document.pages.find((item) => item.id === id)!;

    expect(resolveAspect(document, page("archive"))).toEqual({
      aspectId: "summer",
      source: "page",
      fromPageId: "archive",
    });
    expect(resolveAspect(document, page("old-fair"))).toEqual({
      aspectId: "summer",
      source: "ancestor",
      fromPageId: "archive",
    });
  });

  it("emits a stored id even when it is absent from the catalog", () => {
    const document = doc();
    const fair = document.pages.find((item) => item.id === "fair")!;
    fair.aspectId = "legacy";
    expect(resolveAspect(document, fair)).toEqual({
      aspectId: "legacy",
      source: "page",
      fromPageId: "fair",
    });
    expect(aspectClassName("legacy")).toBe("aspect-legacy");
  });

  it("returns no aspect when nothing in the chain sets one", () => {
    const document = parseSiteDocument({
      version: 2,
      site: { id: "s", title: "S", homePageId: "home", defaultLayoutId: "page" },
      layouts: [{ id: "page", root: { type: "zone", id: "main" } }],
      pages: [
        { id: "home", title: "Home", zones: {} },
        { id: "about", title: "About", parentId: "home", zones: {} },
      ],
    });
    const about = document.pages.find((item) => item.id === "about")!;
    expect(resolveAspect(document, about)).toEqual({ source: "site" });
  });

  it("rejects a missing parent and a cycle", () => {
    const document = doc();
    const fair = document.pages.find((item) => item.id === "fair")!;
    fair.parentId = "missing";
    expect(() => resolveAspect(document, fair)).toThrow(/parent missing not found/);

    const events = document.pages.find((item) => item.id === "events")!;
    events.aspectId = undefined;
    events.parentId = "fair";
    fair.parentId = "events";
    fair.aspectId = undefined;
    expect(() => resolveAspect(document, fair)).toThrow(/Page cycle at fair/);
  });
});

describe("SiteMeta aspects", () => {
  it("rejects a defaultAspectId outside the catalog", () => {
    expect(() =>
      parseSiteDocument({
        version: 2,
        site: {
          id: "s",
          title: "S",
          homePageId: "home",
          defaultLayoutId: "page",
          aspects: [{ id: "summer", label: "Summer" }],
          defaultAspectId: "night",
        },
        layouts: [{ id: "page", root: { type: "zone", id: "main" } }],
        pages: [{ id: "home", title: "Home", zones: {} }],
      }),
    ).toThrow(/defaultAspectId/);
  });
});
