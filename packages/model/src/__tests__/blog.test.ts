import { describe, expect, it } from "vitest";
import {
  ARTICLE_LAYOUT_ID,
  blogHeroStyle,
  blogHeroWidth,
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
    parentId: "news",
    includes: ["common-footer"],
    masterLayoutId: "other",
    fields: { date: "2026-07-14" },
  });

  it("parents an article on its blog and drops includes and frame", () => {
    const [placedNews, placedIndex, placed] = placeArticles([news, index, fair]);
    expect(placedNews).toBe(news);
    expect(placedIndex?.includes).toBeUndefined();
    expect(placed?.parentId).toBe("news");
    expect(placed?.includes).toBeUndefined();
    expect(placed?.masterLayoutId).toBeUndefined();
  });

  it("refuses an article with no blog parent, tenant fields, and invalid blogs", () => {
    expect(() =>
      placeArticles([
        page({ id: "fair", title: "Fair", type: "article", fields: { date: "2026-07-14" } }),
      ]),
    ).toThrow(/must belong to a blog/);
    expect(() =>
      placeArticles([
        news,
        page({
          id: "fair",
          title: "Fair",
          type: "article",
          parentId: "news",
          fields: { tenant: "hall", date: "2026-07-14" },
        }),
      ]),
    ).toThrow(/must not name a tenant/);
    expect(() =>
      placeArticles([page({ id: "news", title: "News", type: "blog", fields: { tenant: "hall" } }), fair]),
    ).toThrow(/must not name a tenant/);
    expect(() =>
      placeArticles([
        page({ id: "fair", title: "Fair", type: "article", parentId: "home", fields: { date: "2026-07-14" } }),
        page({ id: "home", title: "Home", type: "standard" }),
      ]),
    ).toThrow(/not a blog/);
  });

  it("accepts a blog hero of full, banner, or side", () => {
    expect(blogHeroStyle(undefined)).toBe("banner");
    expect(blogHeroStyle({ heroStyle: "side" })).toBe("side");
    expect(blogHeroStyle({ heroStyle: "nope" })).toBe("banner");
    expect(blogHeroWidth(undefined)).toBe("full");
    expect(blogHeroWidth({ heroWidth: "half" })).toBe("half");
    expect(blogHeroWidth({ heroWidth: "nope" })).toBe("full");
    expect(() =>
      placeArticles([
        page({ id: "news", title: "News", type: "blog", fields: { heroStyle: "wide" } }),
        fair,
      ]),
    ).toThrow(/hero must be full, banner, or side/);
    expect(() =>
      placeArticles([
        page({ id: "news", title: "News", type: "blog", fields: { heroWidth: "wide" } }),
        fair,
      ]),
    ).toThrow(/hero width must be/);
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
