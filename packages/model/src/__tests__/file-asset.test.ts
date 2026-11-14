import { describe, expect, it } from "vitest";
import { fileTypeOverlay, folderAssetDisplayName } from "../file-asset.js";

describe("fileTypeOverlay", () => {
  it("maps common extensions", () => {
    expect(fileTypeOverlay("pdf")).toBe("PDF");
    expect(fileTypeOverlay("docx")).toBe("DOC");
    expect(fileTypeOverlay("xls")).toBe("XLS");
    expect(fileTypeOverlay("zip")).toBe("ZIP");
  });

  it("falls back to a short uppercase token", () => {
    expect(fileTypeOverlay("7z")).toBe("7Z");
  });
});

describe("folderAssetDisplayName", () => {
  it("strips sacrificial prefix from filenames", () => {
    expect(folderAssetDisplayName("01-annual-report.pdf")).toBe("Annual Report");
  });

  it("prefers title", () => {
    expect(folderAssetDisplayName("01-x.pdf", "Summary")).toBe("Summary");
  });
});
