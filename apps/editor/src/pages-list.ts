import {
  collectNavPageOrder,
  parseSiteDocument,
  resolveNavTree,
  type NavEntry,
  type Page,
  type SiteDocument,
} from "@r-a-i-t-h/tessera-model";
import type { RecordSummary } from "./api.js";
import { buildContentCreationRank, compareAlpha } from "./creation-rank.js";

/** Site-tree pages that may be a content page's `parentId` (not articles or blog indexes). */
export function isParentPageCandidate(row: RecordSummary): boolean {
  return row.kind === "content" && row.type !== "article" && row.type !== "blog-index";
}

/** Sorted ids for the Page tab parent control. */
export function parentPageIds(rows: readonly RecordSummary[]): string[] {
  return rows
    .filter(isParentPageCandidate)
    .map((row) => row.id)
    .sort((a, b) => a.localeCompare(b));
}

export type PageListOrder = "created" | "alpha" | "nested" | "nav";

export type ListedPage = { row: RecordSummary; depth: number };

export type PageListSortContext = {
  creationRank: ReadonlyMap<string, number>;
  navDocument?: SiteDocument;
  /** Site home page. Always listed first; other pages keep the chosen order. */
  homePageId?: string;
};

const STUB_LAYOUT = {
  id: "stub",
  root: { type: "zone" as const, id: "main" },
};

export function readPageListOrder(): PageListOrder {
  try {
    const value = localStorage.getItem("tessera.pages.listOrder");
    if (value === "created" || value === "alpha" || value === "nested" || value === "nav") return value;
  } catch {
    // localStorage unavailable
  }
  return "created";
}

export function writePageListOrder(order: PageListOrder): void {
  try {
    localStorage.setItem("tessera.pages.listOrder", order);
  } catch {
    // ignore
  }
}

export function buildNavSortDocument(
  siteData: Record<string, unknown>,
  nav: NavEntry[],
  pageRows: readonly RecordSummary[],
  itemRows: readonly RecordSummary[],
): SiteDocument {
  const homePageId =
    typeof siteData.homePageId === "string" && siteData.homePageId.trim()
      ? siteData.homePageId.trim()
      : "home";
  const pages: Page[] = pageRows.map((row) => ({
    id: row.id,
    title: row.title ?? row.id,
    ...(row.type ? { type: row.type } : {}),
    ...(row.parentId ? { parentId: row.parentId } : {}),
    zones: {},
  }));
  const items = itemRows.map((row) => ({
    id: row.id,
    ...(row.tags?.length ? { tags: [...row.tags] } : {}),
    zones: {},
  }));
  return parseSiteDocument({
    version: 2,
    site: {
      id: typeof siteData.id === "string" ? siteData.id : "site",
      title: typeof siteData.title === "string" ? siteData.title : "Site",
      homePageId,
      defaultLayoutId: "stub",
    },
    layouts: [STUB_LAYOUT],
    pages,
    items,
    nav,
    bindings: [],
    types: [],
    media: [],
    folders: [],
  });
}

export function sortPages(
  rows: readonly RecordSummary[],
  order: PageListOrder,
  ctx: PageListSortContext,
): ListedPage[] {
  const list = [...rows];
  const ordered =
    order === "created"
      ? [...list].reverse().map((row) => ({ row, depth: 0 }))
      : order === "alpha"
        ? [...list].sort(compareAlpha).map((row) => ({ row, depth: 0 }))
        : order === "nested"
          ? nestedPages(list)
          : order === "nav"
            ? navPages(list, ctx)
            : list.map((row) => ({ row, depth: 0 }));
  return pinHomePage(ordered, homePageIdFrom(ctx));
}

function homePageIdFrom(ctx: PageListSortContext): string {
  const explicit = ctx.homePageId?.trim();
  if (explicit) return explicit;
  return ctx.navDocument?.site.homePageId.trim() ?? "";
}

/** Home stays first. Pages nested under it in this list stay with it, shifted up to the root. */
function pinHomePage(listed: ListedPage[], homePageId: string): ListedPage[] {
  if (!homePageId) return listed;
  const index = listed.findIndex((item) => item.row.id === homePageId);
  if (index < 0) return listed;
  const homeDepth = listed[index]!.depth;
  let end = index + 1;
  while (end < listed.length && listed[end]!.depth > homeDepth) end += 1;
  if (index === 0 && homeDepth === 0) return listed;
  const block = listed.slice(index, end).map((item) => ({ ...item, depth: item.depth - homeDepth }));
  return [...block, ...listed.slice(0, index), ...listed.slice(end)];
}

function nestedPages(rows: RecordSummary[]): ListedPage[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const childIds = new Map<string, RecordSummary[]>();
  const roots: RecordSummary[] = [];

  for (const row of rows) {
    const parentId = row.parentId;
    if (parentId && byId.has(parentId)) {
      const siblings = childIds.get(parentId) ?? [];
      siblings.push(row);
      childIds.set(parentId, siblings);
    } else {
      roots.push(row);
    }
  }

  const sortSiblings = (siblings: RecordSummary[]) => [...siblings].sort(compareAlpha);

  const out: ListedPage[] = [];
  const walk = (row: RecordSummary, depth: number) => {
    out.push({ row, depth });
    for (const child of sortSiblings(childIds.get(row.id) ?? [])) walk(child, depth + 1);
  };
  for (const root of sortSiblings(roots)) walk(root, 0);
  return out;
}

function navPages(rows: RecordSummary[], ctx: PageListSortContext): ListedPage[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const allowed = new Set(byId.keys());
  const doc = ctx.navDocument;
  if (!doc) {
    return [...rows].sort(compareAlpha).map((row) => ({ row, depth: 0 }));
  }
  const tree = resolveNavTree(doc);
  const ordered = collectNavPageOrder(tree, allowed);
  const out: ListedPage[] = [];
  const seen = new Set<string>();
  for (const { id, depth } of ordered) {
    const row = byId.get(id);
    if (!row) continue;
    seen.add(id);
    out.push({ row, depth });
  }
  const remainder = [...rows].filter((row) => !seen.has(row.id)).sort(compareAlpha);
  for (const row of remainder) out.push({ row, depth: 0 });
  return out;
}

/** Build creation rank from a full listing (all content rows). */
export { buildContentCreationRank };
