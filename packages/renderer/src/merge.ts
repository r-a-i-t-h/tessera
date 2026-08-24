import type { Block, Item, Page, SiteDocument } from "@r-a-i-t-h/tessera-model";
import type { ZoneMap } from "./types.js";

function appendZones(target: ZoneMap, zones: Record<string, Block[]> | undefined): void {
  if (!zones) return;
  for (const [zoneId, blocks] of Object.entries(zones)) {
    const existing = target.get(zoneId) ?? [];
    target.set(zoneId, existing.concat(blocks));
  }
}

/**
 * Merge page zones then included items (in includes order).
 * Contributions to zones the layout does not declare remain available on the
 * ZoneMap for components (e.g. JSON data for a custom list) but are not shown
 * unless a layout zone node or component reads them.
 */
export function mergeZones(
  document: SiteDocument,
  page: Page,
  itemsById: Map<string, Item>,
): ZoneMap {
  const map: ZoneMap = new Map();
  appendZones(map, page.zones);

  for (const itemId of page.includes ?? []) {
    const item = itemsById.get(itemId);
    if (item) appendZones(map, item.zones);
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
