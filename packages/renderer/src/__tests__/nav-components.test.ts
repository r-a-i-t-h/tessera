import { describe, expect, it } from "vitest";
import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import { parseSiteDocument } from "@r-a-i-t-h/tessera-model";
import { breadcrumbs, linkCluster } from "../builtins/nav.js";
import { escapeHtml } from "../render.js";
import { ComponentRegistry } from "../registry.js";
import type { RenderContext } from "../types.js";

function context(document: SiteDocument, pageId: string): RenderContext {
  const page = document.pages.find((item) => item.id === pageId);
  if (!page) throw new Error(pageId);
  return {
    document,
    page,
    profile: { layoutId: "L", layoutSource: "site" },
    zones: new Map(),
    registry: new ComponentRegistry(),
    renderBlocks: () => "",
    zoneJson: () => [],
    mediaHtml: () => "",
    escapeHtml,
  };
}

const document = parseSiteDocument({
  version: 2,
  site: { id: "s", title: "Hall", homePageId: "home" },
  layouts: [{ id: "L", root: { type: "region", children: [{ type: "zone", id: "main" }] } }],
  pages: [
    { id: "home", title: "Home", layoutId: "L", zones: {}, tags: ["page"] },
    { id: "events", title: "Events", parentId: "home", layoutId: "L", zones: {}, tags: ["page"] },
    { id: "fair", title: "Summer fair", parentId: "events", layoutId: "L", zones: {}, tags: ["event"] },
    { id: "orphan", title: "Orphan", layoutId: "L", zones: {} },
  ],
  nav: [
    { id: "home", title: "Home", sidebar: true },
    {
      heading: "What's on",
      sidebar: true,
      children: [{ id: "events", title: "Events", sidebar: true }],
    },
  ],
});

describe("breadcrumbs", () => {
  it("walks parentId from the current page back to home", () => {
    const html = breadcrumbs(context(document, "fair"));
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="#home"');
    expect(html).toContain('href="#events"');
    expect(html).toContain('<span aria-current="page">Summer fair</span>');
    expect(html.indexOf("Home")).toBeLessThan(html.indexOf("Events"));
    expect(html.indexOf("Events")).toBeLessThan(html.indexOf("Summer fair"));
  });

  it("shows the home page as the current crumb", () => {
    const html = breadcrumbs(context(document, "home"));
    expect(html).toContain('<span aria-current="page">Home</span>');
    expect(html).not.toContain("<a ");
  });

  it("starts an unparented page at home", () => {
    const html = breadcrumbs(context(document, "orphan"));
    expect(html).toContain('href="#home"');
    expect(html).toContain('<span aria-current="page">Orphan</span>');
  });
});

describe("linkCluster", () => {
  it("lists published children of the current page", () => {
    const html = linkCluster(context(document, "home"), { source: "children", title: "In this section" });
    expect(html).toContain("In this section");
    expect(html).toContain('href="#events"');
    expect(html).toContain("Events");
    expect(html).not.toContain("Summer fair");
  });

  it("lists pages with a tag as pills", () => {
    const html = linkCluster(context(document, "home"), { source: "tag", tag: "event", variant: "pills" });
    expect(html).toContain("tessera-links-pills");
    expect(html).toContain('href="#fair"');
    expect(html).not.toContain('href="#home"');
  });

  it("lists the children of a designed nav heading as cards", () => {
    const html = linkCluster(context(document, "home"), {
      source: "nav",
      heading: "What's on",
      variant: "cards",
    });
    expect(html).toContain("tessera-link-card");
    expect(html).toContain('href="#events"');
  });

  it("renders nothing when the cluster is empty", () => {
    expect(linkCluster(context(document, "fair"), { source: "children" })).toBe("");
    expect(linkCluster(context(document, "home"), { source: "tag", tag: "missing" })).toBe("");
    expect(linkCluster(context(document, "home"), { source: "nav", heading: "Absent" })).toBe("");
  });
});
