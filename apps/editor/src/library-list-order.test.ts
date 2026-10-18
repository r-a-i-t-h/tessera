import { describe, expect, it } from "vitest";
import { sortLibraryAssets, type LibraryAssetListOrder } from "./library-list-order.js";
import type { AssetRow } from "./forms/library.js";

function asset(id: string, name: string, addedAt?: string): AssetRow {
  return {
    id,
    name,
    kind: "image",
    ext: "svg",
    folderId: null,
    url: `./media/${id}.svg`,
    ...(addedAt ? { addedAt } : {}),
  };
}

describe("sortLibraryAssets", () => {
  const rows = [asset("b", "Beta.svg"), asset("a", "Alpha.svg"), asset("c", "Gamma.svg")];

  it("sorts alphabetically by name", () => {
    expect(sortLibraryAssets(rows, "alpha").map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by addedAt newest first with undated last", () => {
    const dated = [
      asset("old", "old.svg", "2020-01-01T00:00:00.000Z"),
      asset("new", "new.svg", "2024-01-01T00:00:00.000Z"),
      asset("plain", "plain.svg"),
    ];
    expect(sortLibraryAssets(dated, "added").map((row) => row.id)).toEqual(["new", "old", "plain"]);
  });

  it("accepts only alpha and added orders", () => {
    const order: LibraryAssetListOrder = "added";
    expect(sortLibraryAssets(rows, order).length).toBe(3);
  });
});
