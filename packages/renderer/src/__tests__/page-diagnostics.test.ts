import { describe, expect, it } from "vitest";
import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import {
  analyzePageDiagnostics,
  collectPageItems,
  editorUrl,
} from "../page-diagnostics.js";
import { makeFixtureDoc } from "./fixtures.js";

describe("page diagnostics", () => {
  it("collects merged common items in order", () => {
    const doc = makeFixtureDoc();
    const items = collectPageItems(doc, doc.pages[0]!);
    expect(items.map((i) => i.id)).toEqual(["shared-footer", "promo"]);
    expect(items[0]?.source).toBe("page");
  });

  it("resolves layout profile for a typed page", () => {
    const doc = makeFixtureDoc();
    const info = analyzePageDiagnostics(doc, "hidden-aside");
    expect(info.pageLayoutId).toBe("no-aside");
    expect(info.profile.layoutSource).toBe("type");
    expect(info.profile.typeId).toBe("plain");
    expect(info.items.map((i) => i.id)).toEqual(["shared-footer", "promo"]);
  });

  it("finds bindings from mustache, layout components, and page components", () => {
    const doc: SiteDocument = {
      ...makeFixtureDoc(),
      bindings: [
        { id: "sample-gallery", component: "gallery", props: { folders: ["x"] } },
        { id: "nav-bind", component: "navFlat" },
      ],
      layouts: [
        {
          id: "with-aside",
          includes: ["footer-item"],
          root: {
            type: "region",
            role: "main",
            children: [
              { type: "component", name: "nav-bind" },
              { type: "zone", id: "main" },
            ],
          },
        },
        ...makeFixtureDoc().layouts.filter((l) => l.id === "no-aside"),
      ],
      items: [
        ...makeFixtureDoc().items,
        {
          id: "footer-item",
          zones: {
            footer: [{ type: "text", html: "{{sample-gallery}}" }],
          },
        },
      ],
      pages: [
        {
          id: "home",
          title: "Home",
          zones: {
            main: [{ type: "text", html: "<p>{{sample-gallery}}</p>" }],
          },
        },
      ],
    };

    const info = analyzePageDiagnostics(doc, "home");
    const ids = info.bindings.map((b) => b.id).sort();
    expect(ids).toEqual(["nav-bind", "sample-gallery"]);

    const gallery = info.bindings.find((b) => b.id === "sample-gallery")!;
    expect(gallery.sources).toContain("mustache");
    expect(info.items.some((i) => i.id === "footer-item" && i.source === "pageLayout")).toBe(true);

    const nav = info.bindings.find((b) => b.id === "nav-bind")!;
    expect(nav.sources).toContain("layout:with-aside");
  });

  it("builds editor URLs for preview origin", () => {
    expect(editorUrl("content", "home")).toBe("../#/content/home");
    expect(editorUrl("articles", "news")).toBe("../#/articles/news");
    expect(editorUrl("layouts", "master", { fromPreview: false })).toBe("/#/layouts/master");
  });

  it("includes blog context for articles", () => {
    const doc: SiteDocument = {
      version: 2,
      site: { id: "b", title: "B", homePageId: "home" },
      layouts: [{ id: "L", root: { type: "zone", id: "main" } }],
      pages: [
        { id: "home", title: "Home", zones: {} },
        { id: "news", title: "News", type: "blog", zones: {} },
        { id: "news-index", title: "All news", type: "blog-index", parentId: "news", zones: {} },
        {
          id: "welcome",
          title: "Welcome",
          type: "article",
          parentId: "news",
          fields: { date: "2026-01-01" },
          zones: { main: [] },
        },
      ],
      items: [],
      media: [],
      folders: [],
      nav: [],
      bindings: [],
      types: [],
    };

    const info = analyzePageDiagnostics(doc, "welcome");
    expect(info.blog).toMatchObject({ id: "news", title: "News", indexPageId: "news-index" });
    expect(info.page.fields?.date).toBe("2026-01-01");
  });
});
