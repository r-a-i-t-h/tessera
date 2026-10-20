import type { Block, Page, SiteDocument } from "@r-a-i-t-h/tessera-model";
import {
  resolveMasterLayout,
  resolvePageProfile,
} from "@r-a-i-t-h/tessera-model";
import { indexDocument } from "./merge.js";

const PAGE_ATTR = "data-tessera-page";
const PAGE_ATTR_RE = /(?:^|\s)data-tessera-page\s*=\s*(["'])([\s\S]*?)\1/gi;

/** Item ids merged for this page (same order/rules as `collectPageItems`). */
function includedItemIds(document: SiteDocument, page: Page): string[] {
  const { itemsById, layoutsById } = indexDocument(document);
  const seen = new Set<string>();
  const out: string[] = [];

  const append = (ids: readonly string[] | undefined): void => {
    for (const itemId of ids ?? []) {
      if (seen.has(itemId)) continue;
      seen.add(itemId);
      if (itemsById.has(itemId)) out.push(itemId);
    }
  };

  append(page.includes);

  const pageLayoutId = resolvePageProfile(document, page).layoutId;
  append(layoutsById.get(pageLayoutId)?.includes);

  const masterId = resolveMasterLayout(document, page).layoutId;
  if (masterId && masterId !== pageLayoutId) {
    append(layoutsById.get(masterId)?.includes);
  }

  return out;
}

export type PageLinkRef = {
  id: string;
  title?: string;
  missing?: boolean;
};

export type PageLinkGraph = {
  /** pageId → distinct outgoing targets (stable sort) */
  outgoing: Map<string, string[]>;
  /** pageId → distinct inbound sources (stable sort) */
  incoming: Map<string, string[]>;
};

export type PageLinks = {
  linkedTo: PageLinkRef[];
  linkedFrom: PageLinkRef[];
};

/** Collect `data-tessera-page` target ids from authored HTML (order preserved, duplicates kept). */
export function collectPageRefIds(html: string): string[] {
  if (!html.includes(PAGE_ATTR)) return [];
  const ids: string[] = [];
  PAGE_ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PAGE_ATTR_RE.exec(html)) !== null) {
    const id = match[2]?.trim() ?? "";
    if (id) ids.push(id);
  }
  return ids;
}

function collectZoneRefIds(zones: Record<string, Block[]> | undefined): string[] {
  if (!zones) return [];
  const ids: string[] = [];
  for (const blocks of Object.values(zones)) {
    for (const block of blocks) {
      if (block.type === "text" && block.html) {
        ids.push(...collectPageRefIds(block.html));
      }
    }
  }
  return ids;
}

function outgoingForPage(document: SiteDocument, page: Page): string[] {
  const { itemsById } = indexDocument(document);
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (ids: string[]): void => {
    for (const id of ids) {
      if (id === page.id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  };

  add(collectZoneRefIds(page.zones));

  for (const itemId of includedItemIds(document, page)) {
    const item = itemsById.get(itemId);
    add(collectZoneRefIds(item?.zones));
  }

  return out.sort((a, b) => a.localeCompare(b));
}

/** Build a site-wide graph of wiki-style page links (`data-tessera-page`). */
export function buildPageLinkGraph(document: SiteDocument): PageLinkGraph {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const page of document.pages) {
    outgoing.set(page.id, outgoingForPage(document, page));
    if (!incoming.has(page.id)) incoming.set(page.id, []);
  }

  for (const [fromId, targets] of outgoing) {
    for (const toId of targets) {
      const list = incoming.get(toId) ?? [];
      if (!list.includes(fromId)) list.push(fromId);
      incoming.set(toId, list);
    }
  }

  for (const [id, sources] of incoming) {
    incoming.set(
      id,
      [...sources].sort((a, b) => a.localeCompare(b)),
    );
  }

  return { outgoing, incoming };
}

function toLinkRef(
  id: string,
  pagesById: Map<string, Page>,
): PageLinkRef {
  const page = pagesById.get(id);
  if (!page) return { id, missing: true };
  return { id, title: page.title };
}

/** Resolve linked-to / linked-from lists for one page from a graph. */
export function pageLinksFor(
  graph: PageLinkGraph,
  pageId: string,
  document: SiteDocument,
): PageLinks {
  const { pagesById } = indexDocument(document);
  const linkedTo = (graph.outgoing.get(pageId) ?? []).map((id) => toLinkRef(id, pagesById));
  const linkedFrom = (graph.incoming.get(pageId) ?? []).map((id) => toLinkRef(id, pagesById));
  return { linkedTo, linkedFrom };
}
