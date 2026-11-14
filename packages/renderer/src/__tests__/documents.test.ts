import { describe, expect, it } from "vitest";
import { parseSiteDocument } from "@r-a-i-t-h/tessera-model";
import { documents, documentsFromFolders } from "../builtins/documents.js";

const doc = parseSiteDocument({
  version: 2,
  site: { id: "s", title: "S", homePageId: "home" },
  layouts: [{ id: "L", root: { type: "zone", id: "main" } }],
  pages: [{ id: "home", title: "Home", layoutId: "L", zones: {} }],
  folders: [
    {
      id: "pack",
      path: "./media",
      images: [],
      documents: [
        { file: "02-b.pdf", url: "./media/b.pdf", ext: "pdf", kind: "document", title: "Beta" },
        { file: "01-a.svg", url: "./media/a.svg", ext: "svg", kind: "image" },
      ],
    },
  ],
});

describe("documentsFromFolders", () => {
  it("returns rows in folder order", () => {
    expect(documentsFromFolders(doc, ["pack"]).map((r) => r.file)).toEqual(["02-b.pdf", "01-a.svg"]);
  });
});

describe("documents component", () => {
  it("renders icon and thumb rows", () => {
    const html = documents({ document: doc, escapeHtml: (s) => s, page: doc.pages[0]!, pageHref: () => "#" }, {
      folders: ["pack"],
    });
    expect(html).toContain("tessera-documents");
    expect(html).toContain("tessera-file-icon-type");
    expect(html).toContain("PDF");
    expect(html).toContain("tessera-documents-thumb");
    expect(html).toContain("Beta");
  });
});
