import { parseSiteDocument } from "@r-a-i-t-h/tessera-model";
import { ComponentRegistry, escapeHtml, type RenderContext } from "@r-a-i-t-h/tessera-renderer";
import { describe, expect, it } from "vitest";
import { blogArticle } from "./blog.js";

function minimalCtx(overrides: Partial<RenderContext> = {}): RenderContext {
  const document = parseSiteDocument({
    version: 2,
    site: { id: "test", title: "Test", homePageId: "home" },
    layouts: [{ id: "l", root: { type: "region", children: [{ type: "page" }] } }],
    pages: [
      { id: "news", title: "News", type: "blog", fields: { heroStyle: "side" }, zones: {} },
      {
        id: "post",
        title: "Hello",
        type: "article",
        parentId: "news",
        fields: { date: "2026-01-01", hero: "pic" },
        zones: { main: [{ type: "text", html: "<p>Body copy</p>" }] },
      },
    ],
  });
  const page = document.pages[1]!;
  const registry = new ComponentRegistry();
  return {
    document,
    page,
    profile: { layoutId: "tessera-article", layoutSource: "type", typeId: "article" },
    zones: new Map(Object.entries(page.zones ?? {})),
    registry,
    renderBlocks: (blocks) =>
      blocks.map((b) => (b.type === "text" ? b.html : "")).join(""),
    mediaHtml: () => '<img src="./media/pic.jpg" alt="" />',
    escapeHtml,
    assetUrl: (url) => url,
    ...overrides,
  };
}

describe("blogArticle", () => {
  it("places body before hero in side mode so the content grid shares one row", () => {
    const html = blogArticle(minimalCtx());
    expect(html).toContain('data-hero="side"');
    expect(html).toMatch(
      /<div class="tessera-blog-content"><div class="tessera-blog-body"><p>Body copy<\/p><\/div><div class="tessera-blog-hero">/,
    );
  });

  it("keeps hero above body for banner mode", () => {
    const ctx = minimalCtx();
    ctx.document.pages[0]!.fields = { heroStyle: "banner" };
    const html = blogArticle(ctx);
    expect(html).toMatch(
      /<div class="tessera-blog-content"><div class="tessera-blog-hero">[\s\S]*<div class="tessera-blog-body">/,
    );
  });
});
