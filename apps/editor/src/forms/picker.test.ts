import { describe, expect, it } from "vitest";
import { checkedFolderIds, documentLink, foldersValue, imageTag, pickerUpload, renderPicker } from "./picker.js";
import type { LibraryListing } from "./library.js";

const listing: LibraryListing = {
  folders: [
    { id: "hall", parentId: null },
    { id: "attic", parentId: "hall" },
  ],
  assets: [
    { id: "porch", name: "porch.svg", kind: "image", ext: "svg", folderId: null, url: "./media/porch.svg", alt: "The porch" },
    { id: "notes", name: "notes.pdf", kind: "document", ext: "pdf", folderId: null, url: "./media/notes.pdf", title: "Notes" },
  ],
};

describe("library picker", () => {
  it("offers one file, chosen or dropped, into Uploads", () => {
    const html = pickerUpload();
    expect(html).toContain('type="file"');
    expect(html).toContain('accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf"');
    expect(html).toContain("editor-drop");
    expect(html).toContain("Choose or drop one file. It goes into Uploads.");
    expect(html).not.toContain("multiple");
    expect(html).not.toContain("webkitdirectory");
    expect(html).toContain("hidden");
    const shown = pickerUpload("Only one file can be added.");
    expect(shown).toContain("Only one file can be added.");
    expect(shown).not.toContain("hidden");
  });

  it("lists assets vertically with a thumbnail and filename", () => {
    const images = renderPicker(listing, "image", null);
    expect(images).toContain("library-picker-asset-list-order");
    expect(images).toContain("editor-picker-assets");
    expect(images).toContain("/api/library/assets/porch/thumb");
    expect(images).toContain("editor-picker-asset-name");
    expect(images).toContain("porch.svg");
    expect(images).not.toContain("notes.pdf");
    expect(images).not.toContain("editor-pick-grid");
    const docs = renderPicker(listing, "document", null);
    expect(docs).toContain("editor-picker-assets");
    expect(docs).toContain("notes.pdf");
    expect(docs).toContain("editor-thumb-file");
    expect(docs).not.toContain("/thumb");
  });

  it("orders assets by addedAt when recently added is selected", () => {
    const withDates: LibraryListing = {
      ...listing,
      assets: [
        { ...listing.assets[0]!, addedAt: "2020-01-01T00:00:00.000Z" },
        {
          id: "fresh",
          name: "fresh.svg",
          kind: "image",
          ext: "svg",
          folderId: null,
          url: "./media/fresh.svg",
          addedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    };
    const html = renderPicker(withDates, "image", null, "added");
    expect(html.indexOf("fresh.svg")).toBeLessThan(html.indexOf("porch.svg"));
  });

  it("lists folders vertically with Up when nested and Choose in folder mode", () => {
    const root = renderPicker(listing, "image", null);
    expect(root).not.toContain("data-picker-up");
    expect(root).toContain("editor-picker-folders");
    expect(root).toContain('data-open-folder="hall"');

    const nested = renderPicker(listing, "image", "hall");
    expect(nested).toContain('data-picker-up');
    expect(nested.indexOf("data-picker-up")).toBeLessThan(nested.indexOf('data-open-folder="attic"'));

    const folderMode = renderPicker(listing, "folder", null);
    expect(folderMode).toContain('class="editor-picker-folder"');
    expect(folderMode).toContain('data-pick-folder="hall"');
  });

  it("round-trips gallery folder choices", () => {
    const ids = checkedFolderIds([
      { id: "hall", checked: true },
      { id: "uploads", checked: false },
    ]);
    expect(ids).toEqual(["hall"]);
    expect(foldersValue(ids)).toBe("hall");
    expect(foldersValue(["hall", "garden"])).toEqual(["hall", "garden"]);
  });

  it("builds html snippets for library assets", () => {
    const image = listing.assets[0]!;
    const doc = listing.assets[1]!;
    expect(imageTag(image)).toBe('<img src="./media/porch.svg" alt="The porch" />');
    expect(documentLink(doc)).toBe('<a href="./media/notes.pdf">Notes</a>');
  });
});
