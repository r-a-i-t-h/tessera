import { describe, expect, it } from "vitest";
import {
  assetDetail,
  childAssets,
  descendantFolderIds,
  folderDetail,
  libraryBrowseId,
  libraryBrowseIdAfterDelete,
  libraryFolderHash,
  libraryNormalizeBrowseId,
  libraryRouteHash,
  parentFolderOptions,
  placement,
  renderLibrary,
  type LibraryListing,
} from "./library.js";

const listing: LibraryListing = {
  folders: [
    { id: "uploads", parentId: null, system: true },
    { id: "hall", parentId: "uploads" },
    { id: "nested", parentId: "hall" },
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
    expect(html).toContain('data-action="rescan"');
    expect(html).toContain(">Rescan<");
    expect(html).toContain("/api/library/assets/porch/thumb");
    expect(html).toContain("porch.svg");
    expect(html).toContain('data-edit-asset="porch"');
    expect(html).not.toContain("data-delete-asset");
    expect(html).toContain('data-library-crumb="current"');
    expect(html).toContain(`href="${libraryFolderHash(listing.folders, "hall")}"`);
    expect(html).not.toContain("Folder details");
    expect(html).not.toContain("data-edit-folder");
    expect(html).not.toContain('data-delete-folder="nested"');
    expect(childAssets(listing.assets, "hall")).toHaveLength(1);
    const detail = assetDetail(listing.assets[0]!, listing.folders);
    expect(detail).toContain('data-delete-asset="porch"');
    expect(detail).toContain(">Delete<");
    const sized = renderLibrary(
      {
        ...listing,
        assets: [{ ...listing.assets[0]!, width: 320, height: 240 }],
      },
      "hall",
    );
    expect(sized).toContain("porch.svg (320x240)");
    const sizedDetail = assetDetail({ ...listing.assets[0]!, width: 320, height: 240 }, listing.folders);
    expect(sizedDetail).toContain("320 x 240");
    expect(sizedDetail).toContain('data-preview-asset="porch"');
  });

  it("maps browse ids and hash routes", () => {
    expect(libraryBrowseId(listing.folders, "hall")).toBe("uploads/hall");
    expect(libraryBrowseId(listing.folders, "nested")).toBe("uploads/hall/nested");
    expect(libraryRouteHash("uploads/hall")).toBe("#/library/uploads/hall");
    expect(libraryRouteHash(null)).toBe("#/library");
    expect(libraryNormalizeBrowseId(listing.folders, "hall")).toBe("uploads/hall");
    expect(libraryFolderHash(listing.folders, "hall")).toBe("#/library/uploads/hall");
  });

  it("returns the parent browse id after deleting the open folder", () => {
    expect(libraryBrowseIdAfterDelete(listing.folders, "uploads/hall/nested", "nested", "hall")).toBe("uploads/hall");
    expect(libraryBrowseIdAfterDelete(listing.folders, "uploads/hall", "hall", "uploads")).toBe("uploads");
    expect(libraryBrowseIdAfterDelete(listing.folders, "uploads/hall", "nested", "hall")).toBe("uploads/hall");
  });

  it("renders folder details and parent options without cycles", () => {
    const html = renderLibrary(listing, "hall");
    expect(html).toContain('data-library-crumb="current"');
    expect(html).not.toContain("Folder details");
    expect(html).not.toContain("data-delete-folder");
    expect(descendantFolderIds(listing.folders, "hall")).toEqual(new Set(["nested"]));
    const hall = listing.folders.find((folder) => folder.id === "hall")!;
    const options = parentFolderOptions(listing.folders, hall);
    expect(options).toContain('value="uploads"');
    expect(options).not.toContain('value="hall"');
    expect(options).not.toContain('value="nested"');
    const detail = folderDetail(hall, listing.folders);
    expect(detail).toContain('id="folder-detail"');
    expect(detail).toContain('name="nextId"');
    expect(detail).toContain(">Save<");
    const uploads = listing.folders.find((folder) => folder.id === "uploads")!;
    const systemDetail = folderDetail(uploads, listing.folders);
    expect(systemDetail).toContain("System folders cannot be moved or renamed");
    expect(systemDetail).not.toContain('name="nextId"');
  });
});
