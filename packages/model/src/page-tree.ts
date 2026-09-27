import type { Page, SiteDocument } from "./schema.js";

const SEGMENT = /^[a-zA-Z0-9_-]+$/;

export type PageTreeNode = {
  page: Page;
  /** Path under the site root. `""` is the home page. No leading or trailing slash. */
  path: string;
  children: PageTreeNode[];
};

/** Path segment used for a non-home page: `slug` when set, otherwise `id`. */
export function pagePathSegment(page: Page): string {
  const segment = page.slug?.trim() || page.id;
  if (!SEGMENT.test(segment)) {
    throw new Error(
      `Page ${page.id} path segment "${segment}" must match ${SEGMENT}`,
    );
  }
  return segment;
}

/**
 * Published pages as a tree. Every page in the document is included.
 * A page that is still being edited is absent from the document entirely.
 */
export function publishedPageTree(document: SiteDocument): PageTreeNode[] {
  const byId = new Map(document.pages.map((page) => [page.id, page]));
  const homeId = document.site.homePageId;
  if (!byId.has(homeId)) {
    throw new Error(`Home page ${homeId} is missing`);
  }

  const pathOf = new Map<string, string>();

  function pathFor(id: string, stack: string[]): string {
    const known = pathOf.get(id);
    if (known !== undefined) return known;
    if (stack.includes(id)) throw new Error(`Page cycle at ${id}`);
    const page = byId.get(id);
    if (!page) throw new Error(`Unknown page ${id}`);
    if (id === homeId) {
      pathOf.set(id, "");
      return "";
    }
    let parentPath = "";
    if (page.parentId) {
      if (!byId.has(page.parentId)) {
        throw new Error(`Page ${id} parent ${page.parentId} not found`);
      }
      parentPath = pathFor(page.parentId, [...stack, id]);
    }
    const path = parentPath ? `${parentPath}/${pagePathSegment(page)}` : pagePathSegment(page);
    pathOf.set(id, path);
    return path;
  }

  for (const page of document.pages) pathFor(page.id, []);

  const seen = new Map<string, string>();
  for (const [id, path] of pathOf) {
    const prev = seen.get(path);
    if (prev) {
      throw new Error(`Pages ${prev} and ${id} both publish to ${path || "/"}`);
    }
    seen.set(path, id);
  }

  const childIds = new Map<string, string[]>();
  const roots: string[] = [];
  for (const page of document.pages) {
    const parentId = page.id === homeId ? undefined : page.parentId;
    if (parentId && byId.has(parentId)) {
      const list = childIds.get(parentId) ?? [];
      list.push(page.id);
      childIds.set(parentId, list);
    } else {
      roots.push(page.id);
    }
  }

  function node(id: string): PageTreeNode {
    const page = byId.get(id);
    if (!page) throw new Error(`Unknown page ${id}`);
    return {
      page,
      path: pathOf.get(id) ?? "",
      children: (childIds.get(id) ?? []).map(node),
    };
  }

  return roots.map(node);
}

/** Preorder walk. Sibling order is document order. */
export function flattenPageTree(nodes: PageTreeNode[]): PageTreeNode[] {
  const out: PageTreeNode[] = [];
  const walk = (list: PageTreeNode[]) => {
    for (const node of list) {
      out.push(node);
      if (node.children.length) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}
