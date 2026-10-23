import { describe, expect, it } from "vitest";
import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import { createDefaultRegistry } from "../default-registry.js";
import {
  buildMaintenanceReport,
  collectMediaIdsFromHtml,
  listBrokenRefs,
  listOrphanPages,
  listRescanDrift,
  listUnknownBindings,
  listUnreachableNavTargets,
  listUnusedItemsAndLayouts,
  listUnusedLibraryAssets,
  mediaIdFromUrl,
  SCANNED_FOLDER_ID,
} from "../site-reports.js";
import { makeFixtureDoc } from "./fixtures.js";

function baseDoc(overrides: Partial<SiteDocument> = {}): SiteDocument {
  const base = makeFixtureDoc();
  return {
    ...base,
    ...overrides,
    site: { ...base.site, ...(overrides.site ?? {}) },
    pages: overrides.pages ?? base.pages,
    layouts: overrides.layouts ?? base.layouts,
    items: overrides.items ?? base.items,
    media: overrides.media ?? base.media,
    folders: overrides.folders ?? base.folders,
    nav: overrides.nav ?? base.nav,
    bindings: overrides.bindings ?? base.bindings,
  };
}

describe("mediaIdFromUrl / collectMediaIdsFromHtml", () => {
  it("parses library media urls", () => {
    expect(mediaIdFromUrl("./media/porch.svg")).toBe("porch");
    expect(mediaIdFromUrl("/media/notes.pdf")).toBe("notes");
    expect(mediaIdFromUrl("https://example.com/x.png")).toBeUndefined();
  });

  it("collects ids from html attributes", () => {
    expect(
      collectMediaIdsFromHtml(
        `<p><img src="./media/a.png" alt="" /><a href="/media/b.pdf">B</a></p>`,
      ),
    ).toEqual(["a", "b"]);
  });
});

describe("listOrphanPages", () => {
  it("flags pages with no nav and no inbound wiki links", () => {
    const doc = baseDoc({
      nav: [{ id: "home", title: "Home" }],
      pages: [
        {
          id: "home",
          title: "Home",
          zones: {
            main: [
              {
                type: "text",
                html: `<p><a data-tessera-page="linked" href="#">L</a></p>`,
              },
            ],
          },
        },
        { id: "linked", title: "Linked", zones: { main: [] } },
        { id: "lonely", title: "Lonely", zones: { main: [] } },
      ],
    });
    const orphans = listOrphanPages(doc);
    expect(orphans.map((o) => o.href)).toEqual(["#/content/lonely"]);
    expect(orphans[0]?.label).toBe("Lonely");
  });

  it("does not orphan articles under a reachable blog", () => {
    const doc = baseDoc({
      nav: [{ id: "news", title: "News" }],
      pages: [
        { id: "home", title: "Home", zones: {} },
        { id: "news", title: "News", type: "blog", zones: {} },
        {
          id: "news-index",
          title: "Index",
          type: "blog-index",
          parentId: "news",
          zones: {},
        },
        {
          id: "post-1",
          title: "Post",
          type: "article",
          parentId: "news",
          zones: {},
        },
      ],
    });
    expect(listOrphanPages(doc)).toEqual([]);
  });
});

describe("listUnusedLibraryAssets", () => {
  it("lists library-style media that nothing references", () => {
    const doc = baseDoc({
      media: [
        { id: "used", url: "./media/used.png", title: "Used" },
        { id: "spare", url: "./media/spare.png", title: "Spare" },
        { id: "hand", url: "./img/hand.png", title: "Hand" },
      ],
      pages: [
        {
          id: "home",
          title: "Home",
          zones: {
            main: [{ type: "media", id: "used" }],
          },
        },
      ],
      folders: [],
    });
    const unused = listUnusedLibraryAssets(doc);
    expect(unused.map((u) => u.detail)).toEqual(["spare"]);
    expect(unused[0]?.href).toBe("#/library");
  });

  it("counts gallery folder membership as use", () => {
    const doc = baseDoc({
      media: [
        { id: "goat", url: "./media/goat.png" },
        { id: "other", url: "./media/other.png" },
      ],
      folders: [
        {
          id: "goats",
          path: "./media",
          images: [{ file: "goat.png", url: "./media/goat.png" }],
        },
      ],
      bindings: [{ id: "g", component: "gallery", props: { folder: "goats" } }],
      pages: [
        {
          id: "home",
          title: "Home",
          zones: {
            main: [{ type: "component", name: "g" }],
          },
        },
      ],
    });
    // binding props are scanned site-wide; folder goats marks goat used
    const unused = listUnusedLibraryAssets(doc);
    expect(unused.map((u) => u.detail)).toEqual(["other"]);
  });
});

describe("listBrokenRefs", () => {
  it("reports missing page and media refs with source links", () => {
    const doc = baseDoc({
      media: [],
      pages: [
        {
          id: "home",
          title: "Home",
          fields: { hero: "gone-hero" },
          zones: {
            main: [
              {
                type: "text",
                html: `<p><a data-tessera-page="missing-page" href="#">X</a></p>`,
              },
              { type: "media", id: "nope" },
            ],
          },
        },
      ],
    });
    const { brokenRefs, danglingMedia } = listBrokenRefs(doc);
    expect(brokenRefs.some((f) => f.detail === "missing page: missing-page")).toBe(true);
    expect(danglingMedia.some((f) => f.detail === "missing media: nope")).toBe(true);
    expect(danglingMedia.some((f) => f.detail === "missing media: gone-hero")).toBe(true);
    expect(brokenRefs.every((f) => f.href === "#/content/home")).toBe(true);
  });

  it("reports bindings that reference a missing runtime module", () => {
    const doc = baseDoc({
      runtimeModules: [],
      bindings: [
        {
          id: "list",
          component: "runtimeModule",
          props: { module: "gone", dataset: "demo" },
        },
      ],
    });
    const { brokenRefs } = listBrokenRefs(doc);
    expect(brokenRefs.some((f) => f.detail === "missing runtime module: gone")).toBe(true);
    expect(brokenRefs.some((f) => f.href === "#/bindings/list")).toBe(true);
  });
});

describe("listUnusedItemsAndLayouts", () => {
  it("finds items and layouts never referenced", () => {
    const doc = baseDoc({
      items: [
        { id: "shared-footer", zones: {} },
        { id: "dusty", zones: {} },
      ],
      pages: [
        {
          id: "home",
          title: "Home",
          includes: ["shared-footer"],
          zones: {},
        },
      ],
      layouts: [
        {
          id: "with-aside",
          root: { type: "region", role: "main", children: [{ type: "zone", id: "main" }] },
        },
        {
          id: "spare-layout",
          root: { type: "region", role: "main", children: [{ type: "zone", id: "main" }] },
        },
      ],
    });
    const { unusedItems, unusedLayouts } = listUnusedItemsAndLayouts(doc);
    expect(unusedItems.map((i) => i.href)).toEqual(["#/items/dusty"]);
    expect(unusedLayouts.map((l) => l.href)).toContain("#/layouts/spare-layout");
    expect(unusedLayouts.map((l) => l.href)).not.toContain("#/layouts/with-aside");
  });
});

describe("listUnknownBindings", () => {
  it("flags missing mustache bindings and unknown components", () => {
    const registry = createDefaultRegistry();
    registry.define("greet", () => "hi");
    const doc = baseDoc({
      bindings: [{ id: "ok", component: "greet" }],
      pages: [
        {
          id: "home",
          title: "Home",
          zones: {
            main: [
              { type: "text", html: "<p>{{ok}}</p><p>{{missing}}</p>" },
              { type: "component", name: "no-such" },
            ],
          },
        },
      ],
    });
    const hits = listUnknownBindings(doc, registry);
    expect(hits.some((h) => h.detail === "unknown binding: missing")).toBe(true);
    expect(hits.some((h) => h.detail === "unknown component: no-such")).toBe(true);
    expect(hits.every((h) => h.href === "#/content/home")).toBe(true);
  });
});

describe("listUnreachableNavTargets", () => {
  it("lists authored nav ids with no page", () => {
    const doc = baseDoc({
      pages: [{ id: "home", title: "Home", zones: {} }],
      nav: [
        { id: "home", title: "Home" },
        { id: "ghost", title: "Ghost" },
      ],
    });
    const hits = listUnreachableNavTargets(doc);
    expect(hits).toEqual([
      {
        href: "#/records/nav",
        label: "Ghost",
        detail: "missing page: ghost",
      },
    ]);
  });
});

describe("listRescanDrift", () => {
  it("lists scanned-folder assets and dangling media", () => {
    const dangling = [
      { href: "#/content/home", label: "Home", detail: "missing media: x" },
    ];
    const doc = baseDoc({
      media: [{ id: "found", url: "./media/found.png", title: "Found" }],
      folders: [
        {
          id: SCANNED_FOLDER_ID,
          path: "./media",
          images: [{ file: "found.png", url: "./media/found.png" }],
        },
      ],
    });
    const drift = listRescanDrift(doc, dangling);
    expect(drift.danglingMedia).toEqual(dangling);
    expect(drift.scannedAssets[0]?.href).toBe(`#/library/${SCANNED_FOLDER_ID}`);
    expect(drift.scannedAssets[0]?.label).toBe("Found");
  });
});

describe("buildMaintenanceReport", () => {
  it("returns all report sections", () => {
    const report = buildMaintenanceReport(baseDoc(), createDefaultRegistry());
    expect(report).toHaveProperty("orphans");
    expect(report).toHaveProperty("unusedAssets");
    expect(report).toHaveProperty("brokenRefs");
    expect(report).toHaveProperty("unusedItems");
    expect(report).toHaveProperty("unusedLayouts");
    expect(report).toHaveProperty("unknownBindings");
    expect(report).toHaveProperty("unreachableNav");
    expect(report).toHaveProperty("rescanDrift");
  });
});
