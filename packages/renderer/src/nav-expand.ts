import type { NavEntry, SiteDocument } from "@r-a-i-t-h/tessera-model";

/** Resolved nav node: designed structure + content-implied children from `source`. */
export type ResolvedNavNode = {
  id?: string;
  title?: string;
  heading?: string;
  fa?: string;
  sidebar?: boolean;
  topbar?: boolean;
  footer?: boolean;
  /** True when this node was generated from a `source` (not hand-authored). */
  dynamic?: boolean;
  /**
   * Hash suffix. Snapshot links append it to `#pageId`.
   * Pages links append it as `#suffix` on the page href.
   */
  hash?: string;
  children: ResolvedNavNode[];
};

function linksFromSource(
  document: SiteDocument,
  source: NonNullable<NavEntry["source"]>,
  inherit: Pick<NavEntry, "sidebar" | "topbar" | "footer">,
): ResolvedNavNode[] {
  const out: ResolvedNavNode[] = [];

  if (source.pageType) {
    const typeId = source.pageType;
    for (const page of document.pages) {
      if (page.type !== typeId || page.type === "article" || page.type === "blog-index") continue;
      out.push({
        id: page.id,
        title: page.title,
        sidebar: inherit.sidebar,
        topbar: inherit.topbar,
        footer: inherit.footer,
        dynamic: true,
        children: [],
      });
    }
  }

  if (source.itemsTag) {
    const tag = source.itemsTag;
    for (const item of document.items) {
      if (!item.tags?.includes(tag)) continue;
      const page = document.pages.find((p) => p.id === item.id);
      if (!page || page.type === "article") continue;
      out.push({
        id: page.id,
        title: page.title,
        sidebar: inherit.sidebar,
        topbar: inherit.topbar,
        footer: inherit.footer,
        dynamic: true,
        children: [],
      });
    }
  }

  return out;
}

function blogChildren(
  document: SiteDocument,
  pageId: string,
  inherit: Pick<NavEntry, "sidebar" | "topbar" | "footer">,
): ResolvedNavNode[] {
  const blog = document.pages.find((page) => page.id === pageId && page.type === "blog");
  if (!blog) return [];
  const flags = {
    sidebar: inherit.sidebar,
    topbar: inherit.topbar,
    footer: inherit.footer,
    dynamic: true as const,
    children: [] as ResolvedNavNode[],
  };
  const index = document.pages.find((page) => page.type === "blog-index" && page.parentId === blog.id);
  const out: ResolvedNavNode[] = [];
  if (index) out.push({ ...flags, id: index.id, title: index.title });
  const pinned = blog.fields?.tenant?.trim() ?? "";
  if (!pinned) {
    for (const tenant of document.tenants ?? []) {
      out.push({
        ...flags,
        id: blog.id,
        title: tenant.id,
        hash: `tenant/${encodeURIComponent(tenant.id)}`,
      });
    }
  }
  return out;
}

function resolveEntry(document: SiteDocument, entry: NavEntry): ResolvedNavNode {
  const children: ResolvedNavNode[] = [];

  for (const child of entry.children ?? []) {
    children.push(resolveEntry(document, child));
  }

  if (entry.source) {
    children.push(
      ...linksFromSource(document, entry.source, {
        sidebar: entry.sidebar,
        topbar: entry.topbar,
        footer: entry.footer,
      }),
    );
  }

  if (entry.id) {
    children.push(
      ...blogChildren(document, entry.id, {
        sidebar: entry.sidebar,
        topbar: entry.topbar,
        footer: entry.footer,
      }),
    );
  }

  return {
    id: entry.id,
    title: entry.title,
    heading: entry.heading,
    fa: entry.fa,
    sidebar: entry.sidebar,
    topbar: entry.topbar,
    footer: entry.footer,
    children,
  };
}

/**
 * Build a nav tree from designed `document.nav`, resolving `source` into dynamic children.
 * Does not invent entries for pages merely because they exist.
 */
export function resolveNavTree(document: SiteDocument): ResolvedNavNode[] {
  return document.nav.map((e) => resolveEntry(document, e));
}

/** Depth-first flatten (headings + links) for nav components. */
export function flattenNav(nodes: ResolvedNavNode[]): ResolvedNavNode[] {
  const out: ResolvedNavNode[] = [];
  const walk = (list: ResolvedNavNode[]) => {
    for (const n of list) {
      out.push({ ...n, children: [] });
      if (n.children.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}
