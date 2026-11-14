import {
  fileTypeOverlay,
  folderAssetDisplayName,
  formatFileBytes,
  tesseraFileIconHtml,
  type Folder,
  type FolderDocument,
  type SiteDocument,
} from "@r-a-i-t-h/tessera-model";
import { normalizeSiteAssetUrl } from "../assets.js";
import { escapeHtml } from "../render.js";
import type { ComponentFn } from "../types.js";

export type DocumentRow = FolderDocument & { url: string };

function folderById(document: SiteDocument): Map<string, Folder> {
  return new Map((document.folders ?? []).map((f) => [f.id, f]));
}

function folderIdsFromProps(props: Record<string, unknown>): string[] {
  const raw = props.folders ?? props.folder;
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  return [];
}

/** Rows from one or more folder records (concat in folder order). */
export function documentsFromFolders(
  document: SiteDocument,
  folderIds: string[],
  filter?: string | RegExp,
): DocumentRow[] {
  const re =
    filter === undefined || filter === ""
      ? null
      : typeof filter === "string"
        ? new RegExp(filter)
        : filter;
  const byId = folderById(document);
  const rows: DocumentRow[] = [];
  for (const id of folderIds) {
    const folder = byId.get(id);
    if (!folder) continue;
    for (const doc of folder.documents ?? []) {
      if (re && !re.test(doc.file)) continue;
      const raw = doc.url ?? `${folder.path.replace(/\/$/, "")}/${doc.file}`;
      rows.push({ ...doc, url: normalizeSiteAssetUrl(raw) });
    }
  }
  return rows;
}

function rowVisual(row: DocumentRow, src: string): string {
  const ext = row.ext ?? row.file.replace(/^.*\./, "").toLowerCase();
  if (row.kind === "image" || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
    return `<img class="tessera-documents-thumb" src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" />`;
  }
  return tesseraFileIconHtml(ext, escapeHtml, "tessera-file-icon tessera-documents-file-icon");
}

/**
 * Folder file list: every asset in the folder(s), gallery-style order, sacrificial prefix stripped from labels.
 */
export const documents: ComponentFn = (ctx, props = {}) => {
  const folderIds = folderIdsFromProps(props);
  const filter = typeof props.filter === "string" ? props.filter : undefined;
  const rows = folderIds.length ? documentsFromFolders(ctx.document, folderIds, filter) : [];
  if (!rows.length) {
    return `<p class="w3-text-grey"><em>No documents.</em></p>`;
  }
  const items = rows
    .map((row) => {
      const href = ctx.assetUrl ? ctx.assetUrl(row.url) : row.url;
      const label = folderAssetDisplayName(row.file, row.title);
      const ext = row.ext ?? row.file.replace(/^.*\./, "").toLowerCase();
      const metaParts = [fileTypeOverlay(ext)];
      if (row.bytes !== undefined) metaParts.push(formatFileBytes(row.bytes));
      const meta = metaParts.join(" · ");
      const visual = rowVisual(row, href);
      return `<li class="tessera-documents-item">
        <a class="tessera-documents-link" href="${escapeHtml(href)}">
          <span class="tessera-documents-visual">${visual}</span>
          <span class="tessera-documents-label">${escapeHtml(label)}</span>
          <span class="tessera-documents-meta">${escapeHtml(meta)}</span>
        </a>
      </li>`;
    })
    .join("\n");
  return `<ul class="tessera-documents">${items}</ul>`;
};

export function registerDocumentsComponents(define: (name: string, fn: ComponentFn) => unknown): void {
  define("documents", documents);
}
