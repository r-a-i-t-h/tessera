import { describe, expect, it } from "vitest";
import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import { parseSiteDocument } from "@r-a-i-t-h/tessera-model";
import { breadcrumbs, linkCluster, navCollapse, navFlat, navPane, navTree, subpageList } from "../builtins/nav.js";
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
    { id: "fair", title: "Summer fair", parentId: "events", type: "event", zones: {} },
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

  it("lists pages of a type as pills", () => {
    const html = linkCluster(context(document, "home"), { source: "type", type: "event", variant: "pills" });
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
    expect(linkCluster(context(document, "home"), { source: "type", type: "missing" })).toBe("");
    expect(linkCluster(context(document, "home"), { source: "nav", heading: "Absent" })).toBe("");
  });
});

describe("nav link labels", () => {
  it("uses the page title when the nav entry has no title", () => {
    const doc = parseSiteDocument({
      ...document,
      nav: [{ id: "events", sidebar: true }],
    });
    const html = navFlat(context(doc, "home"), { scope: "sidebar" });
    expect(html).toContain(">Events</a>");
    expect(html).not.toContain(">events</a>");
  });
});

describe("nav ancestor highlight", () => {
  const ctx = context(document, "fair");

  it("highlights a nav ancestor when the current page is not in the menu", () => {
    const flat = navFlat(ctx, { scope: "sidebar" });
    expect(flat).toMatch(
      /<a class="w3-bar-item w3-button is-active w3-theme-l3" href="#events">Events<\/a>/,
    );
    expect(flat).not.toContain('href="#fair"');
  });

  it("keeps the highlighted ancestor link navigable", () => {
    for (const html of [
      navFlat(ctx, { scope: "sidebar" }),
      navTree(ctx, { scope: "sidebar" }),
      navCollapse(ctx, { scope: "sidebar" }),
    ]) {
      expect(html).toContain('href="#events">Events</a>');
    }
  });

  it("applies pane active styling to the ancestor without aria-current", () => {
    const html = navPane(ctx, { scope: "sidebar" });
    expect(html).toContain("tessera-nav-child-current");
    expect(html).toContain('href="#events">Events</a>');
    expect(html).not.toContain('aria-current="page"');
  });

  it("expands collapse siblings when the page is a descendant of a group member", () => {
    const doc = parseSiteDocument({
      ...document,
      pages: [
        ...document.pages,
        { id: "workshops", title: "Workshops", parentId: "events", layoutId: "L", zones: {} },
      ],
      nav: [
        { id: "home", title: "Home", sidebar: true },
        {
          heading: "What's on",
          sidebar: true,
          children: [
            { id: "events", title: "Events", sidebar: true },
            { id: "workshops", title: "Workshops", sidebar: true },
          ],
        },
      ],
    });
    const html = navCollapse(context(doc, "fair"), { scope: "sidebar" });
    expect(html).toContain("tessera-nav-sublinks");
    expect(html).toMatch(
      /<a class="w3-bar-item w3-button is-active w3-theme-l3" href="#events">Events<\/a>/,
    );
  });

  it("still marks the exact page on pane links with aria-current", () => {
    const html = navPane(context(document, "home"), { scope: "sidebar" });
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('href="#home"');
  });

  it("does not treat home as an ancestor without an explicit parentId chain", () => {
    const html = navFlat(context(document, "orphan"), { scope: "sidebar" });
    expect(html).toMatch(/<a class="w3-bar-item w3-button" href="#home">Home<\/a>/);
    expect(html).not.toMatch(/is-active w3-theme-l3/);
  });

  it("does not highlight home when an off-menu page has no parent chain to it", () => {
    const doc = parseSiteDocument({
      version: 2,
      site: { id: "s", title: "Hall", homePageId: "home" },
      layouts: [{ id: "L", root: { type: "region", children: [{ type: "zone", id: "main" }] } }],
      pages: [
        { id: "home", title: "Home", layoutId: "L", zones: {} },
        { id: "detached", title: "Detached", layoutId: "L", zones: {} },
        { id: "leaf", title: "Leaf", parentId: "detached", layoutId: "L", zones: {} },
      ],
      nav: [
        { id: "home", title: "Home", sidebar: true },
        { id: "detached", title: "Detached", sidebar: true },
      ],
    });
    const flat = navFlat(context(doc, "leaf"), { scope: "sidebar" });
    expect(flat).toMatch(
      /<a class="w3-bar-item w3-button is-active w3-theme-l3" href="#detached">Detached<\/a>/,
    );
    const offNav = parseSiteDocument({
      ...doc,
      nav: [{ id: "home", title: "Home", sidebar: true }],
    });
    const lonely = navFlat(context(offNav, "leaf"), { scope: "sidebar" });
    expect(lonely).not.toContain("is-active");
  });
});

describe("nav places", () => {
  it("lets a component keep the links marked for its place", () => {
    const doc = parseSiteDocument({
      ...document,
      nav: [
        { id: "home", title: "Home", sidebar: true, topbar: true },
        { id: "events", title: "Events", footer: true },
      ],
    });
    const ctx = context(doc, "home");
    const footer = navFlat(ctx, { scope: "footer" });
    expect(footer).toContain('href="#events"');
    expect(footer).not.toContain('href="#home"');
    const top = navFlat(ctx, { scope: "topbar" });
    expect(top).toContain('href="#home"');
    expect(top).not.toContain('href="#events"');
    const tree = navTree(ctx, { scope: "footer" });
    expect(tree).toContain('href="#events"');
    expect(tree).not.toContain('href="#home"');
    expect(tree).toContain('class="w3-ul tessera-nav-tree tessera-nav-footer"');
    const sidebarTree = navTree(ctx, { scope: "sidebar" });
    expect(sidebarTree).toContain('class="w3-ul tessera-nav-tree"');
    expect(sidebarTree).not.toContain("tessera-nav-footer");
  });
});

describe("navPane", () => {
  const groupPages = [
    { id: "home", title: "Home", layoutId: "L", zones: {}, tags: ["page"] },
    { id: "about", title: "About", layoutId: "L", zones: {} },
    { id: "origins", title: "Origins", layoutId: "L", zones: {} },
  ];
  const groupDoc = parseSiteDocument({
    version: 2,
    site: { id: "s", title: "Hall", homePageId: "home" },
    layouts: [{ id: "L", root: { type: "region", children: [{ type: "zone", id: "main" }] } }],
    pages: groupPages,
    nav: [
      { id: "home", title: "Home", sidebar: true },
      {
        heading: "About section",
        sidebar: true,
        children: [
          { id: "about", title: "About", sidebar: true },
          { id: "origins", title: "Origins", sidebar: true },
        ],
      },
    ],
  });

  it("wraps pane markup and marks the active page", () => {
    const html = navPane(context(groupDoc, "home"), { scope: "sidebar" });
    expect(html).toContain('class="tessera-nav-pane-root w3-bar-block"');
    expect(html).toContain('class="w3-bar-item w3-button tessera-nav-current"');
    expect(html).toContain('href="#home"');
  });

  it("uses group labels and child link classes", () => {
    const html = navPane(context(groupDoc, "origins"), { scope: "sidebar" });
    expect(html).toContain('class="w3-bar-item tessera-nav-group-label"');
    expect(html).toContain("About section");
    expect(html).toContain("tessera-nav-children");
    expect(html).toContain('class="w3-bar-item w3-button tessera-nav-child tessera-nav-child-current"');
    expect(html).toContain('href="#origins"');
    expect(html).not.toContain("is-active");
  });

  it("treats a headingless group like grouped: first link top-level, rest sub-level", () => {
    const doc = parseSiteDocument({
      version: 2,
      site: { id: "s", title: "Hall", homePageId: "home" },
      layouts: [{ id: "L", root: { type: "region", children: [{ type: "zone", id: "main" }] } }],
      pages: groupPages,
      nav: [
        { id: "home", title: "Home", sidebar: true },
        {
          sidebar: true,
          children: [
            { id: "about", title: "About", sidebar: true },
            { id: "origins", title: "Origins", sidebar: true },
          ],
        },
      ],
    });
    const html = navPane(context(doc, "origins"), { scope: "sidebar" });
    expect(html).toMatch(
      /<a class="w3-bar-item w3-button(?: tessera-nav-current)?" href="#about">About<\/a>/,
    );
    expect(html).not.toMatch(/tessera-nav-child[^"]*" href="#about"/);
    expect(html).toContain("tessera-nav-children");
    expect(html).toContain('class="w3-bar-item w3-button tessera-nav-child tessera-nav-child-current"');
    expect(html).toContain('href="#origins"');
    expect(html).not.toContain("tessera-nav-group-label");
  });
});

describe("navCollapse", () => {
  const groupPages = [
    { id: "home", title: "Home", layoutId: "L", zones: {}, tags: ["page"] },
    { id: "about", title: "About", layoutId: "L", zones: {} },
    { id: "origins", title: "Origins", layoutId: "L", zones: {} },
  ];
  const groupDoc = parseSiteDocument({
    version: 2,
    site: { id: "s", title: "Hall", homePageId: "home" },
    layouts: [{ id: "L", root: { type: "region", children: [{ type: "zone", id: "main" }] } }],
    pages: groupPages,
    nav: [
      { id: "home", title: "Home", sidebar: true },
      {
        heading: "About section",
        sidebar: true,
        children: [
          { id: "about", title: "About", sidebar: true },
          { id: "origins", title: "Origins", sidebar: true },
        ],
      },
    ],
  });

  it("hides the heading label and shows only the first link when the group is inactive", () => {
    const html = navCollapse(context(groupDoc, "home"), { scope: "sidebar" });
    expect(html).toContain('href="#about"');
    expect(html).not.toContain("About section");
    expect(html).not.toContain('href="#origins"');
    expect(html).not.toContain("<details");
  });

  it("shows siblings in sub-level markup when the current page is in the group", () => {
    const html = navCollapse(context(groupDoc, "origins"), { scope: "sidebar" });
    expect(html).toContain('href="#about"');
    expect(html).toContain('href="#origins"');
    expect(html).toContain("tessera-nav-tree");
    expect(html).not.toContain("About section");
    expect(html).not.toContain("<details");
  });

  it("keeps the section entry top-level when siblings use sub-level list markup", () => {
    const html = navCollapse(context(groupDoc, "origins"), { scope: "sidebar" });
    expect(html).toMatch(
      /<a class="w3-bar-item w3-button(?: is-active w3-theme-l3)?" href="#about">About<\/a>/,
    );
    expect(html).toMatch(
      /<ul class="w3-ul tessera-nav-tree tessera-nav-sublinks"><li><a class="w3-bar-item w3-button is-active w3-theme-l3" href="#origins">Origins<\/a><\/li><\/ul>/,
    );
  });

  it("supports a group with no heading text", () => {
    const doc = parseSiteDocument({
      version: 2,
      site: { id: "s", title: "Hall", homePageId: "home" },
      layouts: [{ id: "L", root: { type: "region", children: [{ type: "zone", id: "main" }] } }],
      pages: groupPages,
      nav: [
        {
          sidebar: true,
          children: [
            { id: "about", title: "About", sidebar: true },
            { id: "origins", title: "Origins", sidebar: true },
          ],
        },
      ],
    });
    const inactive = navCollapse(context(doc, "home"), { scope: "sidebar" });
    expect(inactive).toContain('href="#about"');
    expect(inactive).not.toContain('href="#origins"');
    const active = navCollapse(context(doc, "origins"), { scope: "sidebar" });
    expect(active).toContain("tessera-nav-tree");
    expect(active).toContain('href="#origins"');
    expect(active).not.toContain("<details");
  });
});

describe("optional heading labels", () => {
  it("omits an empty heading in Top-level and Sub-level menus", () => {
    const doc = parseSiteDocument({
      version: 2,
      site: { id: "s", title: "Hall", homePageId: "home" },
      layouts: [{ id: "L", root: { type: "region", children: [{ type: "zone", id: "main" }] } }],
      pages: [
        { id: "home", title: "Home", layoutId: "L", zones: {} },
        { id: "about", title: "About", layoutId: "L", zones: {} },
      ],
      nav: [
        {
          sidebar: true,
          children: [{ id: "about", title: "About", sidebar: true }],
        },
      ],
    });
    const flat = navFlat(context(doc, "home"), { scope: "sidebar" });
    expect(flat).not.toContain("<h4");
    expect(flat).toContain('href="#about"');
    const tree = navTree(context(doc, "home"), { scope: "sidebar" });
    expect(tree).not.toContain("w3-text-theme");
    expect(tree).toContain('href="#about"');
  });
});

describe("subpageList", () => {
  it("lists the current page's children with Tessera list styling", () => {
    const html = subpageList(context(document, "home"), { title: "In this section" });
    expect(html).toContain("<h3>In this section</h3>");
    expect(html).toContain("tessera-subpages-list");
    expect(html).not.toContain("w3-hoverable");
    expect(html).toContain('href="#events"');
    expect(html).toContain("Events");
    expect(html).not.toContain("Summer fair");
  });

  it("applies an optional panel tone class on the nav", () => {
    const html = subpageList(context(document, "home"), { tone: "sand" });
    expect(html).toContain("w3-sand");
  });

  it("renders nothing when the page has no children", () => {
    expect(subpageList(context(document, "fair"), {})).toBe("");
  });

  it("orders children alphabetically when none have a date", () => {
    const doc = parseSiteDocument({
      version: 2,
      site: { id: "s", title: "Hall", homePageId: "home" },
      layouts: [{ id: "L", root: { type: "region", children: [{ type: "zone", id: "main" }] } }],
      pages: [
        { id: "home", title: "Home", zones: {} },
        { id: "z-page", title: "Zulu", parentId: "home", zones: {} },
        { id: "a-page", title: "Alpha", parentId: "home", zones: {} },
      ],
    });
    const html = subpageList(context(doc, "home"), {});
    expect(html.indexOf("Alpha")).toBeLessThan(html.indexOf("Zulu"));
  });

  it("orders children by date newest first when any have fields.date", () => {
    const doc = parseSiteDocument({
      version: 2,
      site: { id: "s", title: "Hall", homePageId: "home" },
      layouts: [{ id: "L", root: { type: "region", children: [{ type: "zone", id: "main" }] } }],
      pages: [
        { id: "blog", title: "Blog", zones: {} },
        {
          id: "old-post",
          title: "Old",
          parentId: "blog",
          type: "article",
          fields: { date: "2026-01-01" },
          zones: {},
        },
        {
          id: "new-post",
          title: "New",
          parentId: "blog",
          type: "article",
          fields: { date: "2026-03-15" },
          zones: {},
        },
        {
          id: "no-date",
          title: "Undated",
          parentId: "blog",
          zones: {},
        },
      ],
    });
    const html = subpageList(context(doc, "blog"), {});
    expect(html.indexOf("New")).toBeLessThan(html.indexOf("Old"));
    expect(html.indexOf("Old")).toBeLessThan(html.indexOf("Undated"));
  });
});
