import { describe, expect, it } from "vitest";
import { ComponentRegistry, mergeZones, renderPage, resolvePageId } from "../index.js";
import { indexDocument } from "../merge.js";
import { makeFixtureDoc } from "./fixtures.js";

function registryWithDefaults() {
  const registry = new ComponentRegistry();
  registry.define("greet", (_ctx, props = {}) => `Hi ${String(props.name ?? "")}`);
  registry.define("eventList", (ctx, props = {}) => {
    const zone = typeof props.fromZone === "string" ? props.fromZone : "events";
    return ctx
      .zoneJson<{ title: string }>(zone)
      .map((e) => e.title)
      .join(",");
  });
  return registry;
}

describe("renderPage", () => {
  it("renders zones, components, and includes", () => {
    const doc = makeFixtureDoc();
    const html = renderPage({
      document: doc,
      pageId: "home",
      registry: registryWithDefaults(),
    });

    expect(html).toContain("Home title");
    expect(html).toContain("<p>Hello</p>");
    expect(html).toContain("Hi world");
    expect(html).toContain("Alpha,Beta");
    expect(html).toContain("Page aside");
    expect(html).toContain("Promo aside");
    expect(html).toContain("Shared footer");
    expect(html).toContain('src="./media/sample.svg"');
    expect(html).toContain('alt="Sample"');
  });

  it("hides zone content when the layout does not declare the zone", () => {
    const doc = makeFixtureDoc();
    const html = renderPage({
      document: doc,
      pageId: "hidden-aside",
      registry: registryWithDefaults(),
    });

    expect(html).toContain("No aside layout");
    expect(html).toContain("<p>Body</p>");
    expect(html).toContain("Shared footer");
    expect(html).not.toContain("Should not show");
    expect(html).not.toContain("Promo aside");
  });

  it("keeps undeclared zone data available to components via zoneJson", () => {
    const doc = makeFixtureDoc();
    const { itemsById } = indexDocument(doc);
    const page = doc.pages.find((p) => p.id === "home")!;
    const zones = mergeZones(doc, page, itemsById);
    expect(zones.get("events")?.[0]).toMatchObject({ type: "json" });
  });

  it("normalizes root-absolute media URLs to relative", () => {
    const doc = makeFixtureDoc();
    doc.pages[0]!.zones.main = [{ type: "media", id: "rooted" }];
    const html = renderPage({
      document: doc,
      pageId: "home",
      registry: registryWithDefaults(),
    });
    expect(html).toContain('src="./media/rooted.svg"');
    expect(html).not.toContain('src="/media/rooted.svg"');
  });

  it("does not paint raw json blocks as HTML", () => {
    const doc = makeFixtureDoc();
    doc.layouts[0]!.root = {
      type: "region",
      children: [{ type: "zone", id: "events" }],
    };
    const html = renderPage({
      document: doc,
      pageId: "home",
      registry: registryWithDefaults(),
    });
    expect(html).not.toContain("Alpha");
  });

  it("throws for unknown page or layout", () => {
    const doc = makeFixtureDoc();
    const registry = registryWithDefaults();
    expect(() =>
      renderPage({ document: doc, pageId: "missing", registry }),
    ).toThrow(/Unknown page/);

    doc.pages[0]!.layoutId = "nope";
    expect(() =>
      renderPage({ document: doc, pageId: "home", registry }),
    ).toThrow(/Unknown layout/);
  });

  it("resolves layout from a matching section when page.layoutId is omitted", () => {
    const doc = makeFixtureDoc();
    doc.site.defaultLayoutId = "with-aside";
    doc.sections = [
      {
        id: "events",
        match: { tags: ["event"] },
        layoutId: "no-aside",
      },
    ];
    doc.pages.push({
      id: "event-x",
      title: "Event X",
      tags: ["event"],
      zones: {
        title: [{ type: "text", html: "From section" }],
        main: [{ type: "text", html: "<p>Body</p>" }],
        footer: [{ type: "text", html: "Foot" }],
      },
    });
    const html = renderPage({
      document: doc,
      pageId: "event-x",
      registry: registryWithDefaults(),
    });
    expect(html).toContain("From section");
    expect(html).toContain("<p>Body</p>");
  });

  it("applies skin region classes", () => {
    const doc = makeFixtureDoc();
    const html = renderPage({
      document: doc,
      pageId: "home",
      registry: registryWithDefaults(),
      skin: {
        regionClass: (role, className) =>
          ["skinned", role ? `role-${role}` : "", className].filter(Boolean).join(" "),
      },
    });
    expect(html).toContain('class="skinned role-main"');
  });

  it("wraps the page layout in the master and fills the page slot", () => {
    const doc = makeFixtureDoc();
    doc.site.masterLayoutId = "master";
    doc.layouts.push({
      id: "master",
      root: {
        type: "region",
        id: "frame",
        children: [
          { type: "static", html: "<header>Frame</header>" },
          { type: "page" },
        ],
      },
    });
    const html = renderPage({
      document: doc,
      pageId: "home",
      registry: registryWithDefaults(),
    });
    expect(html).toContain("<header>Frame</header>");
    expect(html).toContain('id="frame"');
    expect(html).toContain("Home title");
    expect(html.indexOf("Frame")).toBeLessThan(html.indexOf("Home title"));
  });
});

describe("authored zone HTML", () => {
  it("publishes zone HTML as written and expands binding tokens", () => {
    const doc = makeFixtureDoc();
    const home = doc.pages.find((page) => page.id === "home");
    home!.zones.main = [
      {
        type: "text",
        html: `<div class="w3-panel w3-card-4 w3-round-large w3-sand"><p>Words</p></div>\n{{people-preview}}`,
      },
    ];
    const html = renderPage({
      document: doc,
      pageId: "home",
      registry: registryWithDefaults(),
    });
    expect(html).toContain("w3-panel w3-card-4 w3-round-large w3-sand");
    expect(html).toContain("<p>Words</p>");
    expect(html).toContain("<!-- unknown binding: people-preview -->");
    expect(html).not.toContain("{{people-preview}}");
  });

  it("expands a subpages marker into a W3CSS list of child pages", () => {
    const doc = makeFixtureDoc();
    const about = doc.pages.find((page) => page.id === "about");
    about!.parentId = "home";
    const home = doc.pages.find((page) => page.id === "home");
    home!.zones.main = [
      {
        type: "text",
        html: `<nav class="tessera-subpages w3-margin-bottom" data-tessera="subpages" data-title="In this section"></nav>`,
      },
    ];
    const html = renderPage({
      document: doc,
      pageId: "home",
      registry: registryWithDefaults(),
    });
    expect(html).toContain("w3-ul w3-hoverable w3-border");
    expect(html).toContain("In this section");
    expect(html).toContain("About");
    expect(html).not.toContain("data-tessera");
  });

  it("expands a gallery marker through the gallery component", () => {
    const doc = makeFixtureDoc();
    doc.folders = [
      {
        id: "lambs",
        path: "./media/lambs",
        images: [{ file: "01-nile.svg" }],
      },
    ];
    const home = doc.pages.find((page) => page.id === "home");
    home!.zones.main = [
      {
        type: "text",
        html: `<div class="tessera-page-gallery w3-margin-bottom" data-tessera="gallery" data-folder="lambs" data-mode="grid"></div>`,
      },
    ];
    const html = renderPage({
      document: doc,
      pageId: "home",
      registry: registryWithDefaults(),
    });
    expect(html).toContain("<tessera-gallery");
    expect(html).toContain("01-nile.svg");
    expect(html).not.toContain("data-tessera");
  });

  it("leaves a pasted note's authored HTML in place", () => {
    const doc = makeFixtureDoc();
    const home = doc.pages.find((page) => page.id === "home");
    home!.zones.main = [
      {
        type: "text",
        html: `<div class="tessera-pasted w3-margin-bottom"><div class="tessera-pasted-sheet"><p>Written for this page.</p></div></div>`,
      },
    ];
    const html = renderPage({
      document: doc,
      pageId: "home",
      registry: registryWithDefaults(),
    });
    expect(html).toContain("tessera-pasted-sheet");
    expect(html).toContain("<p>Written for this page.</p>");
  });
});

describe("resolvePageId", () => {
  it("resolves hash, home fallback, and unknown hash", () => {
    const doc = makeFixtureDoc();
    expect(resolvePageId(doc, "about")).toBe("about");
    expect(resolvePageId(doc, "#about")).toBe("about");
    expect(resolvePageId(doc, "")).toBe("home");
    expect(resolvePageId(doc, "nope")).toBe("home");
  });
});
