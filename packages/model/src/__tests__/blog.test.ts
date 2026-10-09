import { describe, expect, it } from "vitest";
import {
  ARTICLE_LAYOUT_ID,
  assertBlogTenants,
  blogHeroStyle,
  injectBlogLayouts,
  markBlogLinks,
  placeArticles,
  type Page,
} from "../index.js";

function page(partial: Page): Page {
  return { zones: {}, ...partial };
}

describe("placeArticles", () => {
  const news = page({
    id: "news",
    title: "News",
    type: "blog",
    fields: { pageSize: "10" },
  });
  const index = page({
    id: "news-index",
    title: "Index",
    type: "blog-index",
    parentId: "news",
  });
  const fair = page({
    id: "fair",
    title: "Fair",
    type: "article",
    includes: ["common-footer"],
    masterLayoutId: "other",
    fields: { tenant: "hall", date: "2026-07-14" },
  });

  it("parents an article on the unscoped blog and drops includes and frame", () => {
    const [placedNews, placedIndex, placed] = placeArticles([news, index, fair]);
    expect(placedNews).toBe(news);
    expect(placedIndex?.slug).toBe("index");
    expect(placedIndex?.includes).toBeUndefined();
    expect(placed?.parentId).toBe("news");
    expect(placed?.includes).toBeUndefined();
    expect(placed?.masterLayoutId).toBeUndefined();
  });

  it("parents an article on the blog that names its tenant", () => {
    const hall = page({ id: "hall-blog", title: "Hall", type: "blog", fields: { tenant: "hall" } });
    const placed = placeArticles([news, hall, fair]).find((item) => item.id === "fair");
    expect(placed?.parentId).toBe("hall-blog");
  });

  it("refuses an article with no blog, two unscoped blogs, and a shared tenant", () => {
    expect(() => placeArticles([fair])).toThrow(/no blog/);
    expect(() =>
      placeArticles([
        news,
        page({ id: "other", title: "Other", type: "blog" }),
      ]),
    ).toThrow(/omit a tenant/);
    expect(() =>
      placeArticles([
        page({ id: "a", title: "A", type: "blog", fields: { tenant: "hall" } }),
        page({ id: "b", title: "B", type: "blog", fields: { tenant: "hall" } }),
      ]),
    ).toThrow(/Two blogs/);
  });

  it("refuses a tenant that is not a tenant record", () => {
    expect(() => assertBlogTenants(placeArticles([news, fair]), [])).toThrow(/not a tenant record/);
    expect(() => assertBlogTenants(placeArticles([news, fair]), ["hall"])).not.toThrow();
  });

  it("accepts a blog hero of full, banner, or side", () => {
    expect(blogHeroStyle(undefined)).toBe("banner");
    expect(blogHeroStyle({ heroStyle: "side" })).toBe("side");
    expect(blogHeroStyle({ heroStyle: "nope" })).toBe("banner");
    expect(() =>
      placeArticles([page({ id: "news", title: "News", type: "blog", fields: { heroStyle: "wide" } }), fair]),
    ).toThrow(/hero must be full, banner, or side/);
    expect(() =>
      placeArticles([page({ id: "news", title: "News", type: "blog", fields: { heroStyle: "full" } }), fair]),
    ).not.toThrow();
  });

  it("replaces a site layout that reuses a built-in id", () => {
    const layouts = injectBlogLayouts([
      { id: ARTICLE_LAYOUT_ID, root: { type: "region", children: [] } },
      { id: "standard", root: { type: "region", children: [] } },
    ]);
    expect(layouts.map((layout) => layout.id)).toEqual([
      "tessera-article",
      "tessera-blog",
      "tessera-blog-index",
      "standard",
    ]);
    expect(layouts[0]?.root).toMatchObject({ children: [{ type: "component", name: "blogArticle" }] });
  });

  it("marks a blog link", () => {
    expect(markBlogLinks([{ id: "news", title: "News", sidebar: true }], new Set(["news"]))).toEqual([
      { id: "news", title: "News", sidebar: true, source: { blog: true } },
    ]);
  });
});
