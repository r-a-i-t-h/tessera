import { describe, expect, it } from "vitest";
import { checkedFolderIds, documentLink, foldersValue, imageSlideSnippet, imageTag, mediaBlockSnippet, renderPicker } from "./picker.js";
import type { LibraryListing } from "./library.js";

const listing: LibraryListing = {
  folders: [{ id: "hall", parentId: null }],
  assets: [
    { id: "porch", name: "porch.svg", kind: "image", ext: "svg", folderId: null, url: "./media/porch.svg", alt: "The porch" },
    { id: "notes", name: "notes.pdf", kind: "document", ext: "pdf", folderId: null, url: "./media/notes.pdf", title: "Notes" },
  ],
};

describe("library picker", () => {
  it("shows image thumbnails and document names", () => {
    const images = renderPicker(listing, "image", null);
    expect(images).toContain("/api/library/assets/porch/thumb");
    expect(images).not.toContain("notes.pdf");
    const docs = renderPicker(listing, "document", null);
    expect(docs).toContain("notes.pdf");
    expect(docs).not.toContain("/thumb");
  });

  it("inserts an image tag, a document link, a media block, and a slide", () => {
    const image = listing.assets[0]!;
    const doc = listing.assets[1]!;
    expect(imageTag(image)).toBe('<img src="./media/porch.svg" alt="The porch" />');
    expect(documentLink(doc)).toBe('<a href="./media/notes.pdf">Notes</a>');
    expect(mediaBlockSnippet(image)).toContain("id: porch");
    expect(imageSlideSnippet(image)).toContain("url: ./media/porch.svg");
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
});
