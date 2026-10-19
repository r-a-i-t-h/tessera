import { describe, expect, it } from "vitest";
import { renderPage } from "../index.js";
import { resolvePageRefs, rewritePageRefIds } from "../page-refs.js";
import type { RenderContext } from "../types.js";
import { makeFixtureDoc } from "./fixtures.js";
import { ComponentRegistry } from "../registry.js";

function ctxFor(doc = makeFixtureDoc()): RenderContext {
  return {
    document: doc,
    page: doc.pages[0]!,
    profile: { layoutId: "home", layoutSource: "site" },
    zones: new Map(),
    registry: new ComponentRegistry(),
    renderBlocks: () => "",
    zoneJson: () => [],
    mediaHtml: () => "",
    escapeHtml: (s) => s,
  };
}

describe("resolvePageRefs", () => {
  it("rewrites data-tessera-page to #id in snapshot mode", () => {
    const html = resolvePageRefs(
      `<p>See <a data-tessera-page="about" href="#">About</a>.</p>`,
      ctxFor(),
    );
    expect(html).toContain('href="#about"');
    expect(html).toContain('data-tessera-page="about"');
    expect(html).not.toContain("tessera-page-missing");
  });

  it("marks missing targets", () => {
    const html = resolvePageRefs(
      `<a data-tessera-page="gone" href="#">Gone</a>`,
      ctxFor(),
    );
    expect(html).toContain('href="#"');
    expect(html).toContain("tessera-page-missing");
  });

  it("uses pageHref when provided", () => {
    const ctx = ctxFor();
    ctx.pageHref = (id) => `./${id}/`;
    const html = resolvePageRefs(`<a data-tessera-page="about" href="#">About</a>`, ctx);
    expect(html).toContain('href="./about/"');
  });
});

describe("rewritePageRefIds", () => {
  it("rewrites the attribute value", () => {
    const html = rewritePageRefIds(
      `<a data-tessera-page="about" href="#">About</a>`,
      "about",
      "story",
    );
    expect(html).toContain('data-tessera-page="story"');
    expect(html).not.toContain('data-tessera-page="about"');
  });
});

describe("renderPage page refs", () => {
  it("resolves prose page refs in zones", () => {
    const doc = makeFixtureDoc();
    const about = doc.pages.find((p) => p.id === "about");
    if (about) {
      about.zones = {
        main: [
          {
            type: "text",
            html: `<p>Go <a data-tessera-page="home" href="#">home</a>.</p>`,
          },
        ],
      };
    }
    const html = renderPage({
      document: doc,
      pageId: "about",
      registry: new ComponentRegistry(),
    });
    expect(html).toContain('data-tessera-page="home"');
    expect(html).toContain('href="#home"');
  });
});
