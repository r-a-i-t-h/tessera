import { captionFromFilename } from "./schema.js";

/** Uppercase type label on the doc-sheet icon (PDF, DOC, XLS, …). */
export function fileTypeOverlay(ext: string): string {
  const key = ext.replace(/^\./, "").toLowerCase();
  const map: Record<string, string> = {
    pdf: "PDF",
    doc: "DOC",
    docx: "DOC",
    xls: "XLS",
    xlsx: "XLS",
    ppt: "PPT",
    pptx: "PPT",
    txt: "TXT",
    csv: "CSV",
    zip: "ZIP",
    rtf: "RTF",
    md: "MD",
  };
  if (map[key]) return map[key]!;
  const bare = key.replace(/[^a-z0-9]/g, "");
  if (!bare) return "FILE";
  return bare.slice(0, 4).toUpperCase();
}

/** Public list label: explicit title, else filename with ordering prefix stripped. */
export function folderAssetDisplayName(file: string, title?: string): string {
  const trimmed = title?.trim();
  if (trimmed) return trimmed;
  return captionFromFilename(file);
}

export function formatFileBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function tesseraFileIconHtml(
  ext: string,
  escapeHtml: (value: string) => string,
  className = "tessera-file-icon",
): string {
  const label = fileTypeOverlay(ext);
  const aria = escapeHtml(`${label} document`);
  return (
    `<span class="${escapeHtml(className)}" role="img" aria-label="${aria}">` +
    `<span class="tessera-file-icon-sheet" aria-hidden="true"></span>` +
    `<span class="tessera-file-icon-type">${escapeHtml(label)}</span></span>`
  );
}
