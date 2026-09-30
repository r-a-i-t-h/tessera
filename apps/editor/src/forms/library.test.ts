import { describe, expect, it } from "vitest";
import { childAssets, placement, renderLibrary, type LibraryListing } from "./library.js";

const listing: LibraryListing = {
  folders: [
    { id: "uploads", title: "Uploads", parentId: null },
    { id: "hall", title: "Hall", parentId: "uploads" },
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
    expect(html).toContain("Add files");
    expect(html).toContain('value="uploads"');
    expect(html).toContain("New folder");
    expect(html).toContain("/api/library/assets/porch/thumb");
    expect(html).toContain("porch.svg");
    expect(childAssets(listing.assets, "hall")).toHaveLength(1);
  });
});
