import { describe, expect, it } from "vitest";
import { parseSiteDocument } from "@r-a-i-t-h/tessera-model";
import { registerNavComponents } from "../builtins/nav.js";
import { publishPages } from "../publish-pages.js";
import { ComponentRegistry } from "../registry.js";

const document = parseSiteDocument({
  version: 2,
  site: { id: "hall", title: "Willow Hall", homePageId: "home", masterLayoutId: "master" },
  layouts: [
    {
      id: "master",
      root: {
        type: "region",
        children: [
          { type: "static", html: "<header>Hall frame</header>" },
          { type: "page" },
        ],
      },
    },
    {
      id: "L",
      root: {
        type: "region",
        role: "main",
        children: [
          { type: "zone", id: "title" },
          { type: "zone", id: "main" },
        ],
      },
    },
  ],
  items: [
    {
      id: "events-data",
      zones: {
        events: [{ type: "json", data: [{ title: "Fair" }] }],
      },
    },
  ],
  bindings: [
    {
      id: "upcoming-events",
      component: "eventList",
      itemId: "events-data",
      fromZone: "events",
    },
  ],
  pages: [
    {
      id: "home",
      title: "Home",
      description: "A neighbourhood hall",
      layoutId: "L",
      zones: {
        title: [{ type: "text", html: "Welcome" }],
        main: [{ type: "text", html: "<p>Come in.</p>{{upcoming-events}}" }],
      },
    },
    {
      id: "events",
      title: "Events",
      parentId: "home",
      layoutId: "L",
      zones: {
        title: [{ type: "text", html: "Events" }],
        main: [{ type: "component", name: "eventList", props: { limit: 3 } }],
      },
    },
    {
      id: "fair",
      title: "Summer fair",
      slug: "summer-fair",
      parentId: "events",
      description: "The fair",
      layoutId: "L",
      zones: {
        title: [{ type: "text", html: "Summer fair" }],
        main: [{ type: "text", html: "<p>On the green.</p>" }],
      },
    },
    {
      id: "draft-hidden",
      title: "Private",
      showInNav: false,
      layoutId: "L",
      zones: {
        title: [{ type: "text", html: "Private" }],
        main: [{ type: "text", html: "<p>Not in the menu.</p>" }],
      },
    },
  ],
});

describe("publishPages", () => {
  const files = publishPages(document, { origin: "https://example.test" });
  const byPath = new Map(files.map((file) => [file.path, file.contents]));

  it("writes one HTML file per page and a sitemap", () => {
    expect([...byPath.keys()].sort()).toEqual([
      "draft-hidden/index.html",
      "events/index.html",
      "events/summer-fair/index.html",
      "index.html",
      "sitemap.xml",
    ]);
  });

  it("puts prose, title, description, and canonical in the page file", () => {
    const home = byPath.get("index.html")!;
    expect(home).toContain("<title>Home · Willow Hall</title>");
    expect(home).toContain('<meta name="description" content="A neighbourhood hall" />');
    expect(home).toContain('<link rel="canonical" href="https://example.test/" />');
    expect(home).toContain("Welcome");
    expect(home).toContain("<p>Come in.</p>");
    expect(home).toContain('data-tessera-microapp="upcoming-events"');
    expect(home).toContain('"component":"eventList"');
    expect(home).toContain('"title":"Fair"');
  });

  it("writes the master frame into every page and does not invent a second nav", () => {
    const home = byPath.get("index.html")!;
    const fair = byPath.get("events/summer-fair/index.html")!;
    expect(home).toContain("<header>Hall frame</header>");
    expect(home).toContain("Welcome");
    expect(home).not.toContain('aria-label="Primary"');
    expect(home).not.toContain("Private");
    expect(fair).toContain("<header>Hall frame</header>");
    expect(fair).toContain("<title>Summer fair · Willow Hall</title>");
    expect(fair).toContain('<link rel="canonical" href="https://example.test/events/summer-fair/" />');
  });

  it("leaves a component as a mount and still publishes a hidden page", () => {
    const events = byPath.get("events/index.html")!;
    expect(events).toContain('data-tessera-microapp="eventList"');
    expect(events).toContain('"limit":3');
    expect(events).not.toContain("eventList(");
    const hidden = byPath.get("draft-hidden/index.html")!;
    expect(hidden).toContain("<p>Not in the menu.</p>");
    expect(hidden).not.toContain(">Private</a>");
    expect(byPath.get("index.html")).not.toContain(">Private</a>");
  });

  it("lists every published URL in the sitemap", () => {
    const sitemap = byPath.get("sitemap.xml")!;
    expect(sitemap).toContain("<loc>https://example.test/</loc>");
    expect(sitemap).toContain("<loc>https://example.test/events/</loc>");
    expect(sitemap).toContain("<loc>https://example.test/events/summer-fair/</loc>");
    expect(sitemap).toContain("<loc>https://example.test/draft-hidden/</loc>");
  });

  it("links stylesheets and the pages runtime with a relative prefix", () => {
    const fair = byPath.get("events/summer-fair/index.html")!;
    expect(fair).toContain('href="../../skin/w3.css"');
    expect(fair).toContain('href="../../site.css"');
    expect(fair).toContain('src="../../tessera-pages.js"');
    expect(byPath.get("index.html")).toContain('href="./skin/w3.css"');
  });
});

describe("publishPages catalogue", () => {
  it("writes nav links as page paths and leaves an unknown component as a mount", () => {
    const registry = new ComponentRegistry();
    registerNavComponents((name, fn) => registry.define(name, fn));
    const withNav = parseSiteDocument({
      ...document,
      layouts: document.layouts.map((layout) =>
        layout.id === "master"
          ? {
              ...layout,
              root: {
                type: "region",
                children: [
                  { type: "component", name: "navFlat", props: { scope: "sidebar" } },
                  { type: "component", name: "not-a-component" },
                  layout.root,
                ],
              },
            }
          : layout,
      ),
      nav: [{ id: "events", title: "Events", sidebar: true }],
    });
    const home = publishPages(withNav, { origin: "https://example.test", registry }).find(
      (file) => file.path === "index.html",
    )!;
    expect(home.contents).toContain('href="./events/"');
    expect(home.contents).toContain('data-tessera-microapp="not-a-component"');
    expect(home.contents).not.toContain('href="#events"');
  });
});
