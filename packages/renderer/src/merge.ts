import { resolveMasterLayout, resolvePageProfile } from "@r-a-i-t-h/tessera-model";
import type { Block, Item, Page, SiteDocument } from "@r-a-i-t-h/tessera-model";
import type { ZoneMap } from "./types.js";

function appendZones(target: ZoneMap, zones: Record<string, Block[]> | undefined): void {
  if (!zones) return;
  for (const [zoneId, blocks] of Object.entries(zones)) {
    const existing = target.get(zoneId) ?? [];
    target.set(zoneId, existing.concat(blocks));
  }
}

/** Append each item's zones once. The earliest list that names an id wins. */
function appendIncludes(
  target: ZoneMap,
  ids: readonly string[] | undefined,
  itemsById: Map<string, Item>,
  seen: Set<string>,
): void {
  for (const itemId of ids ?? []) {
    if (seen.has(itemId)) continue;
    seen.add(itemId);
    const item = itemsById.get(itemId);
    if (item) appendZones(target, item.zones);
  }
}

/**
 * Merge page zones, then the page's includes, then the page layout's includes,
 * then the master frame's includes when that layout is a different one.
 * The same item id is merged once. Contributions to zones the layout does not
 * declare remain available on the ZoneMap for components (e.g. JSON data for a
 * custom list) but are not shown unless a layout zone node or component reads them.
 */
export function mergeZones(
  document: SiteDocument,
  page: Page,
  itemsById: Map<string, Item>,
): ZoneMap {
  const map: ZoneMap = new Map();
  const seen = new Set<string>();
  appendZones(map, page.zones);
  appendIncludes(map, page.includes, itemsById, seen);

  const pageLayoutId = resolvePageProfile(document, page).layoutId;
  const pageLayout = document.layouts.find((layout) => layout.id === pageLayoutId);
  appendIncludes(map, pageLayout?.includes, itemsById, seen);

  const masterId = resolveMasterLayout(document, page).layoutId;
  if (masterId && masterId !== pageLayoutId) {
    const master = document.layouts.find((layout) => layout.id === masterId);
    appendIncludes(map, master?.includes, itemsById, seen);
  }

  return map;
}

export function indexDocument(document: SiteDocument) {
  return {
    layoutsById: new Map(document.layouts.map((l) => [l.id, l])),
    pagesById: new Map(document.pages.map((p) => [p.id, p])),
    itemsById: new Map(document.items.map((i) => [i.id, i])),
    mediaById: new Map(document.media.map((m) => [m.id, m])),
  };
}
