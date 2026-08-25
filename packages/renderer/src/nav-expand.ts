import type { NavEntry, SiteDocument } from "@r-a-i-t-h/tessera-model";

/** Resolved nav node: designed structure + content-implied children from `source`. */
export type ResolvedNavNode = {
  id?: string;
  title?: string;
  heading?: string;
  fa?: string;
  sidebar?: boolean;
  topbar?: boolean;
  /** True when this node was generated from a `source` (not hand-authored). */
  dynamic?: boolean;
  children: ResolvedNavNode[];
};

function linksFromSource(
  document: SiteDocument,
  source: NonNullable<NavEntry["source"]>,
  inherit: Pick<NavEntry, "sidebar" | "topbar">,
): ResolvedNavNode[] {
  const out: ResolvedNavNode[] = [];

  if (source.pagesTag) {
    const tag = source.pagesTag;
    for (const page of document.pages) {
      if (!page.tags?.includes(tag)) continue;
      out.push({
        id: page.id,
        title: page.title,
        sidebar: inherit.sidebar,
        topbar: inherit.topbar,
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
      if (!page) continue;
      out.push({
        id: page.id,
        title: item.title ?? page.title,
        sidebar: inherit.sidebar,
        topbar: inherit.topbar,
        dynamic: true,
        children: [],
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

/** Depth-first flatten (headings + links) for simple list chrome. */
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

/** @deprecated Use `resolveNavTree` + a nav component; kept for flat chrome helpers. */
export function expandNav(document: SiteDocument): Array<{
  id?: string;
  title?: string;
  heading?: string;
  fa?: string;
  sidebar?: boolean;
  topbar?: boolean;
}> {
  return flattenNav(resolveNavTree(document));
}
