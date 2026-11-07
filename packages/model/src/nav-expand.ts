import type { NavEntry, SiteDocument } from "./schema.js";

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
  if (index && blog.fields?.showIndexInNav === "true") out.push({ ...flags, id: index.id, title: index.title });
  return out;
}

function pageIsPresent(document: SiteDocument, id: string): boolean {
  return document.pages.some((page) => page.id === id);
}

/** A designed link title wins. Otherwise use the page title. */
function linkTitle(document: SiteDocument, entry: NavEntry): string | undefined {
  if (entry.title?.trim()) return entry.title;
  if (!entry.id) return undefined;
  const pageTitle = document.pages.find((page) => page.id === entry.id)?.title.trim();
  return pageTitle || undefined;
}

function resolveEntry(document: SiteDocument, entry: NavEntry): ResolvedNavNode | undefined {
  if (entry.id && !pageIsPresent(document, entry.id)) return undefined;
  const children: ResolvedNavNode[] = [];

  for (const child of entry.children ?? []) {
    const resolved = resolveEntry(document, child);
    if (resolved) children.push(resolved);
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
    title: linkTitle(document, entry),
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
  const out: ResolvedNavNode[] = [];
  for (const entry of document.nav) {
    const resolved = resolveEntry(document, entry);
    if (resolved) out.push(resolved);
  }
  return out;
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

/** Preorder page ids from a resolved nav tree, with depth for indentation. First occurrence wins. */
export function collectNavPageOrder(
  nodes: ResolvedNavNode[],
  allowedIds: ReadonlySet<string>,
): { id: string; depth: number }[] {
  const out: { id: string; depth: number }[] = [];
  const seen = new Set<string>();

  const walk = (list: ResolvedNavNode[], depth: number) => {
    for (const n of list) {
      if (n.id && allowedIds.has(n.id) && !seen.has(n.id)) {
        seen.add(n.id);
        out.push({ id: n.id, depth });
      }
      if (n.children.length) walk(n.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return out;
}

function navTitleShouldMirror(pageId: string, pageTitle: string, navTitle: string): boolean {
  const nav = navTitle.trim();
  if (!nav) return false;
  const prev = pageTitle.trim();
  if (prev && nav === prev) return true;
  if (!prev && nav === pageId) return true;
  if (prev === pageId && nav === pageId) return true;
  return false;
}

function nextMirroredNavTitle(pageId: string, pageTitle: string): string | undefined {
  const next = pageTitle.trim();
  if (!next || next === pageId) return undefined;
  return next;
}

function rewriteNavPageTitleEntry(
  entry: NavEntry,
  pageId: string,
  previousTitle: string,
  nextTitle: string,
): { entry: NavEntry; changed: boolean } {
  let changed = false;
  let next = entry;

  if (entry.id === pageId && entry.title !== undefined) {
    const designed = entry.title.trim();
    if (designed && navTitleShouldMirror(pageId, previousTitle, designed)) {
      const mirrored = nextMirroredNavTitle(pageId, nextTitle);
      if (mirrored) {
        if (entry.title !== mirrored) {
          next = { ...entry, title: mirrored };
          changed = true;
        }
      } else if (Object.prototype.hasOwnProperty.call(entry, "title")) {
        const { title: _omit, ...rest } = entry;
        next = rest;
        changed = true;
      }
    }
  }

  if (entry.children?.length) {
    let childrenChanged = false;
    const children = entry.children.map((child) => {
      const rewritten = rewriteNavPageTitleEntry(child, pageId, previousTitle, nextTitle);
      if (rewritten.changed) childrenChanged = true;
      return rewritten.entry;
    });
    if (childrenChanged) {
      next = next === entry ? { ...entry, children } : { ...next, children };
      changed = true;
    }
  }

  return { entry: next, changed };
}

/**
 * When a page title changes, update designed nav link titles that still mirrored
 * the previous page title (or the page id when the old title was empty).
 */
export function rewriteNavPageTitle(
  entries: NavEntry[],
  pageId: string,
  previousTitle: string,
  nextTitle: string,
): { nav: NavEntry[]; changed: boolean } {
  if (previousTitle.trim() === nextTitle.trim()) {
    return { nav: entries, changed: false };
  }
  let changed = false;
  const nav = entries.map((entry) => {
    const rewritten = rewriteNavPageTitleEntry(entry, pageId, previousTitle, nextTitle);
    if (rewritten.changed) changed = true;
    return rewritten.entry;
  });
  return { nav, changed };
}
