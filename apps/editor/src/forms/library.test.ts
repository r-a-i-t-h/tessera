import { describe, expect, it } from "vitest";
import { assetDetail, childAssets, placement, renderLibrary, type LibraryListing } from "./library.js";

const listing: LibraryListing = {
  folders: [
    { id: "uploads", parentId: null },
    { id: "hall", parentId: "uploads" },
  ],
  assets: [
    {
      id: "porch",
      name: "porch.svg",
      kind: "image",
      ext: "svg",
      folderId: "hall",
      url: "./media/porch.svg",
      sort: 1,
    },
    {
      id: "notes",
      name: "notes.pdf",
      kind: "document",
      ext: "pdf",
      folderId: "uploads",
      url: "./media/notes.pdf",
      sort: 0,
    },
  ],
};

describe("library browser", () => {
  it("keeps a dropped folder as virtual folders under the destination", () => {
    expect(placement("hall-photos/day/porch.svg")).toEqual({
      folders: ["hall-photos", "day"],
      file: "porch.svg",
    });
    expect(placement("porch.svg")).toEqual({ folders: [], file: "porch.svg" });
    expect(placement("../secret.svg")).toBeUndefined();
  });

  it("renders the open folder with a thumbnail and the add-files choices", () => {
    const html = renderLibrary(listing, "hall");
    expect(html).toContain("editor-library-split");
    expect(html).toContain('id="library-detail"');
    expect(html).toContain('id="library-add"');
    expect(html).toContain("<details");
    expect(html).toContain(" open");
    expect(html).toContain("Add files");
    expect(html).toContain('value="uploads"');
    expect(html).toContain("New folder");
    expect(html).toContain("/api/library/assets/porch/thumb");
    expect(html).toContain("porch.svg");
    expect(html).toContain('data-edit-asset="porch"');
    expect(html).not.toContain("data-delete-asset");
    expect(html).not.toContain(">Details</button>");
    expect(childAssets(listing.assets, "hall")).toHaveLength(1);
    const detail = assetDetail(listing.assets[0]!, listing.folders);
    expect(detail).toContain('data-delete-asset="porch"');
    expect(detail).toContain(">Delete<");
  });
});
