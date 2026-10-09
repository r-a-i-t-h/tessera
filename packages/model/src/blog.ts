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

function tenantOf(page: Page): string {
  return page.fields?.tenant?.trim() ?? "";
}

/**
 * Articles take their parent from the blog that names their tenant, or the one
 * unscoped blog. An article with no such blog is refused. Includes and a page
 * frame are dropped: the frame is the blog's frame.
 */
export function placeArticles(pages: readonly Page[]): Page[] {
  const blogs = pages.filter((page) => page.type === BLOG_TYPE);
  const unscoped = blogs.filter((page) => !tenantOf(page));
  if (unscoped.length > 1) {
    throw new Error("Only one blog may omit a tenant.");
  }
  const byTenant = new Map<string, Page>();
  for (const blog of blogs) {
    const tenant = tenantOf(blog);
    if (!tenant) continue;
    const size = blog.fields?.pageSize?.trim() ?? "";
    if (size && !/^[1-9]\d*$/.test(size)) {
      throw new Error(`Blog ${blog.id} page size must be a positive integer.`);
    }
    if (byTenant.has(tenant)) throw new Error(`Two blogs name tenant ${tenant}.`);
    byTenant.set(tenant, blog);
  }
  for (const blog of unscoped) {
    const size = blog.fields?.pageSize?.trim() ?? "";
    if (size && !/^[1-9]\d*$/.test(size)) {
      throw new Error(`Blog ${blog.id} page size must be a positive integer.`);
    }
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
    const tenant = tenantOf(page);
    if (!tenant) throw new Error(`Article ${page.id} needs a tenant.`);
    const home = byTenant.get(tenant) ?? unscoped[0];
    if (!home) throw new Error(`Article ${page.id} has no blog for tenant ${tenant}.`);
    const next: Page = { ...page, parentId: home.id };
    delete next.includes;
    delete next.masterLayoutId;
    return next;
  });
}

/** A named tenant must be a tenant record. Articles are never untenanted; that check is in `placeArticles`. */
export function assertBlogTenants(pages: readonly Page[], tenantIds: readonly string[]): void {
  const known = new Set(tenantIds);
  for (const page of pages) {
    if (page.type !== ARTICLE_TYPE && page.type !== BLOG_TYPE) continue;
    const tenant = page.fields?.tenant?.trim() ?? "";
    if (!tenant) continue;
    if (!known.has(tenant)) {
      const label = page.type === ARTICLE_TYPE ? "Article" : "Blog";
      throw new Error(`${label} ${page.id} names tenant ${tenant}, which is not a tenant record.`);
    }
  }
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
