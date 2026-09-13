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
        skinId: "amber",
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
