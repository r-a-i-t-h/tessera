import { describe, expect, it } from "vitest";
import { parseSiteDocument, resolveMasterLayout } from "../index.js";

function doc() {
  return parseSiteDocument({
    version: 2,
    site: { id: "s", title: "S", homePageId: "home", masterLayoutId: "master", defaultLayoutId: "page" },
    layouts: [
      {
        id: "master",
        root: { type: "region", children: [{ type: "static", html: "Site" }, { type: "page" }] },
      },
      {
        id: "events-frame",
        root: { type: "region", children: [{ type: "static", html: "Events" }, { type: "page" }] },
      },
      { id: "page", root: { type: "zone", id: "main" } },
    ],
    pages: [
      { id: "home", title: "Home", parentId: "events", zones: {} },
      { id: "events", title: "Events", parentId: "home", masterLayoutId: "events-frame", zones: {} },
      { id: "fair", title: "Fair", parentId: "events", zones: {} },
      { id: "stall", title: "Stall", parentId: "fair", zones: {} },
      { id: "archive", title: "Archive", parentId: "events", masterLayoutId: "master", zones: {} },
      { id: "old-fair", title: "Old fair", parentId: "archive", zones: {} },
      { id: "about", title: "About", zones: {} },
    ],
  });
}

describe("resolveMasterLayout", () => {
  it("uses the nearest ancestor and ignores the home page parent", () => {
    const document = doc();
    const page = (id: string) => document.pages.find((item) => item.id === id)!;

    expect(resolveMasterLayout(document, page("events"))).toEqual({
      layoutId: "events-frame",
      source: "page",
      fromPageId: "events",
    });
    expect(resolveMasterLayout(document, page("stall"))).toEqual({
      layoutId: "events-frame",
      source: "ancestor",
      fromPageId: "events",
    });
    expect(resolveMasterLayout(document, page("home"))).toEqual({
      layoutId: "master",
      source: "site",
    });
    expect(resolveMasterLayout(document, page("about"))).toEqual({
      layoutId: "master",
      source: "site",
    });
  });

  it("lets a nested page name the site frame and reset its descendants", () => {
    const document = doc();
    const page = (id: string) => document.pages.find((item) => item.id === id)!;

    expect(resolveMasterLayout(document, page("archive"))).toEqual({
      layoutId: "master",
      source: "page",
      fromPageId: "archive",
    });
    expect(resolveMasterLayout(document, page("old-fair"))).toEqual({
      layoutId: "master",
      source: "ancestor",
      fromPageId: "archive",
    });
  });

  it("rejects a page layout named as a frame", () => {
    const document = doc();
    const fair = document.pages.find((item) => item.id === "fair")!;
    fair.masterLayoutId = "page";
    expect(() => resolveMasterLayout(document, fair)).toThrow(/Layout page is not a frame/);
  });

  it("rejects a missing parent and a cycle", () => {
    const document = doc();
    const fair = document.pages.find((item) => item.id === "fair")!;
    fair.parentId = "missing";
    expect(() => resolveMasterLayout(document, fair)).toThrow(/parent missing not found/);

    const events = document.pages.find((item) => item.id === "events")!;
    events.masterLayoutId = undefined;
    events.parentId = "fair";
    fair.parentId = "events";
    fair.masterLayoutId = undefined;
    expect(() => resolveMasterLayout(document, fair)).toThrow(/Page cycle at fair/);
  });
});
