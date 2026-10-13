import type { Layout, NavEntry, Page } from "./schema.js";
import {
  ARTICLE_LAYOUT_ID,
  ARTICLE_TYPE,
  BLOG_INDEX_LAYOUT_ID,
  BLOG_INDEX_TYPE,
  BLOG_LAYOUT_ID,
  BLOG_TYPE,
} from "./schema.js";

const RESERVED_LAYOUT_IDS = new Set([ARTICLE_LAYOUT_ID, BLOG_LAYOUT_ID, BLOG_INDEX_LAYOUT_ID]);

/** Layouts the engine paints for a blog, its index, and its articles. */
export function blogLayouts(): Layout[] {
  return [
    {
      id: ARTICLE_LAYOUT_ID,
      root: {
        type: "region",
        className: "tessera-blog-article",
        children: [{ type: "component", name: "blogArticle" }],
      },
    },
    {
      id: BLOG_LAYOUT_ID,
      root: {
        type: "region",
        className: "tessera-blog",
        children: [
          {
            type: "region",
            tag: "h1",
            children: [{ type: "zone", id: "title" }],
          },
          { type: "zone", id: "lead", className: "tessera-blog-lead" },
          { type: "component", name: "blogFeed" },
        ],
      },
    },
    {
      id: BLOG_INDEX_LAYOUT_ID,
      root: {
        type: "region",
        className: "tessera-blog-index",
        children: [
          {
            type: "region",
            tag: "h1",
            children: [{ type: "zone", id: "title" }],
          },
          { type: "component", name: "blogIndex" },
        ],
      },
    },
  ];
}

/** Drop site layouts that reuse a built-in id, then prepend the built-ins. */
export function injectBlogLayouts(layouts: readonly Layout[]): Layout[] {
  return [...blogLayouts(), ...layouts.filter((layout) => !RESERVED_LAYOUT_IDS.has(layout.id))];
}

export function usesBlog(pages: readonly Page[]): boolean {
  return pages.some(
    (page) => page.type === ARTICLE_TYPE || page.type === BLOG_TYPE || page.type === BLOG_INDEX_TYPE,
  );
}

export type BlogHeroStyle = "full" | "banner" | "side";

/** Missing or unknown values use the banner. A set value must be one of the three. */
export function blogHeroStyle(fields: { heroStyle?: string } | undefined): BlogHeroStyle {
  const raw = fields?.heroStyle?.trim() ?? "";
  if (raw === "full" || raw === "banner" || raw === "side") return raw;
  return "banner";
}

function assertHeroStyle(blog: Page): void {
  const hero = blog.fields?.heroStyle?.trim() ?? "";
  if (!hero || hero === "full" || hero === "banner" || hero === "side") return;
  throw new Error(`Blog ${blog.id} hero must be full, banner, or side.`);
}

function assertBlogFields(blog: Page): void {
  if (blog.fields?.tenant?.trim()) {
    throw new Error(`Blog ${blog.id} must not name a tenant.`);
  }
  const size = blog.fields?.pageSize?.trim() ?? "";
  if (size && !/^[1-9]\d*$/.test(size)) {
    throw new Error(`Blog ${blog.id} page size must be a positive integer.`);
  }
  assertHeroStyle(blog);
}

function blogById(pages: readonly Page[], id: string): Page | undefined {
  const page = pages.find((item) => item.id === id);
  return page?.type === BLOG_TYPE ? page : undefined;
}

/**
 * Articles belong to a blog via `parentId`. Includes and a page frame are
 * dropped: the frame is the blog's frame.
 */
export function placeArticles(pages: readonly Page[]): Page[] {
  for (const page of pages) {
    if (page.type === BLOG_TYPE) assertBlogFields(page);
  }

  const indexParents = new Set<string>();
  for (const page of pages) {
    if (page.type !== BLOG_INDEX_TYPE) continue;
    const parent = pages.find((item) => item.id === page.parentId);
    if (!parent || parent.type !== BLOG_TYPE) {
      throw new Error(`Index ${page.id} must belong to a blog.`);
    }
    if (indexParents.has(parent.id)) throw new Error(`Blog ${parent.id} has two indexes.`);
    indexParents.add(parent.id);
  }

  return pages.map((page) => {
    if (page.type === BLOG_INDEX_TYPE) {
      const next: Page = { ...page, slug: "index" };
      delete next.includes;
      delete next.masterLayoutId;
      return next;
    }
    if (page.type !== ARTICLE_TYPE) return page;
    const parentId = page.parentId?.trim() ?? "";
    if (!parentId) throw new Error(`Article ${page.id} must belong to a blog.`);
    if (!blogById(pages, parentId)) {
      throw new Error(`Article ${page.id} parent ${parentId} is not a blog.`);
    }
    if (page.fields?.tenant?.trim()) {
      throw new Error(`Article ${page.id} must not name a tenant.`);
    }
    const next: Page = { ...page, parentId };
    delete next.includes;
    delete next.masterLayoutId;
    return next;
  });
}

/** A blog link stores `source.blog`. Expansion also keys off the page type. */
export function markBlogLinks(entries: readonly NavEntry[], blogIds: ReadonlySet<string>): NavEntry[] {
  return entries.map((entry) => {
    const children = entry.children ? markBlogLinks(entry.children, blogIds) : undefined;
    const next: NavEntry = children ? { ...entry, children } : { ...entry };
    if (!entry.id || !blogIds.has(entry.id)) return next;
    return { ...next, source: { ...(entry.source ?? {}), blog: true } };
  });
}
