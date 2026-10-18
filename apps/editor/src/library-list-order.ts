import type { AssetRow } from "./forms/library.js";

export type LibraryAssetListOrder = "alpha" | "added";

const STORAGE_KEY = "tessera.library.assetListOrder";

export function readLibraryAssetListOrder(): LibraryAssetListOrder {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "added") return "added";
  } catch {
    // localStorage unavailable
  }
  return "alpha";
}

export function writeLibraryAssetListOrder(order: LibraryAssetListOrder): void {
  try {
    localStorage.setItem(STORAGE_KEY, order);
  } catch {
    // localStorage unavailable
  }
}

function compareAlpha(a: AssetRow, b: AssetRow): number {
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  return byName !== 0 ? byName : a.id.localeCompare(b.id);
}

function compareAddedNewestFirst(a: AssetRow, b: AssetRow): number {
  const ta = a.addedAt ? Date.parse(a.addedAt) : Number.NaN;
  const tb = b.addedAt ? Date.parse(b.addedAt) : Number.NaN;
  const aMissing = Number.isNaN(ta);
  const bMissing = Number.isNaN(tb);
  if (aMissing !== bMissing) return aMissing ? 1 : -1;
  if (!aMissing && !bMissing && ta !== tb) return tb - ta;
  return compareAlpha(a, b);
}

export function sortLibraryAssets(assets: AssetRow[], order: LibraryAssetListOrder): AssetRow[] {
  const list = [...assets];
  list.sort(order === "added" ? compareAddedNewestFirst : compareAlpha);
  return list;
}

export function libraryAssetListOrderSelect(order: LibraryAssetListOrder, id = "library-asset-list-order"): string {
  return `<p class="editor-list-order"><label for="${id}">List order</label>
    <select id="${id}" class="w3-select w3-border">
      <option value="alpha"${order === "alpha" ? " selected" : ""}>A–Z</option>
      <option value="added"${order === "added" ? " selected" : ""}>Recently added</option>
    </select></p>`;
}
