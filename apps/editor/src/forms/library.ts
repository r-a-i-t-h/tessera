import { escapeHtml, noticePanel } from "../dom.js";

export type FolderRow = {
  id: string;
  parentId: string | null;
};

export type AssetRow = {
  id: string;
  name: string;
  kind: "image" | "document";
  ext: string;
  folderId: string | null;
  title?: string;
  alt?: string;
  caption?: string;
  sort?: number;
  url: string;
};

export type LibraryListing = {
  folders: FolderRow[];
  assets: AssetRow[];
};

/** Relative path from a drop, as folder ids plus a filename. */
export function placement(relativePath: string): { folders: string[]; file: string } | undefined {
  const cleaned = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!cleaned || cleaned.includes("\0")) return undefined;
  const parts = cleaned.split("/").filter((part) => part.length > 0);
  if (parts.some((part) => part === "." || part === "..")) return undefined;
  const file = parts.pop();
  if (!file) return undefined;
  return { folders: parts, file };
}

export function breadcrumb(folders: FolderRow[], openId: string | null): FolderRow[] {
  const trail: FolderRow[] = [];
  let cursor = openId;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const folder = folders.find((item) => item.id === cursor);
    if (!folder) break;
    trail.unshift(folder);
    cursor = folder.parentId;
  }
  return trail;
}

function bySort(a: { sort?: number; name?: string; id?: string }, b: { sort?: number; name?: string; id?: string }): number {
  const as = a.sort ?? Number.MAX_SAFE_INTEGER;
  const bs = b.sort ?? Number.MAX_SAFE_INTEGER;
  if (as !== bs) return as - bs;
  const an = (a.name ?? a.id ?? "").toLowerCase();
  const bn = (b.name ?? b.id ?? "").toLowerCase();
  return an.localeCompare(bn);
}

export function childFolders(folders: FolderRow[], parentId: string | null): FolderRow[] {
  return folders.filter((folder) => folder.parentId === parentId).sort(bySort);
}

export function childAssets(assets: AssetRow[], folderId: string | null): AssetRow[] {
  return assets.filter((asset) => asset.folderId === folderId).sort(bySort);
}

export function renderLibrary(listing: LibraryListing, openId: string | null, notice = "", addOpen = true): string {
  const trail = breadcrumb(listing.folders, openId);
  const here = openId ? listing.folders.find((folder) => folder.id === openId) : undefined;
  const crumbs = [
    `<a href="#/library">Library</a>`,
    ...trail.map((folder, index) =>
      index === trail.length - 1
        ? `<span>${escapeHtml(folder.id)}</span>`
        : `<a href="#/library/${encodeURIComponent(folder.id)}">${escapeHtml(folder.id)}</a>`,
    ),
  ].join(" / ");
  const folders = childFolders(listing.folders, openId);
  const assets = childAssets(listing.assets, openId);
  const empty = !folders.length && !assets.length;
  const rows = [
    ...folders.map(
      (folder) => `<li class="editor-library-row">
        <a class="editor-library-name" href="#/library/${encodeURIComponent(folder.id)}">${escapeHtml(folder.id)}</a>
        <span class="w3-text-grey w3-small">Folder</span>
        <button type="button" class="w3-button w3-small w3-white" data-delete-folder="${escapeHtml(folder.id)}">Delete</button>
      </li>`,
    ),
    ...assets.map((asset) => {
      const thumb =
        asset.kind === "image"
          ? `<img class="editor-thumb" src="/api/library/assets/${encodeURIComponent(asset.id)}/thumb" alt="" data-fallback="/api/library/assets/${encodeURIComponent(asset.id)}/file" />`
          : `<span class="editor-thumb editor-thumb-file">PDF</span>`;
      return `<li class="editor-library-file-row">
        <button type="button" class="editor-library-row" data-edit-asset="${escapeHtml(asset.id)}">
          ${thumb}
          <span class="editor-library-name">${escapeHtml(asset.name)}</span>
          <span class="w3-text-grey w3-small">${asset.kind === "document" ? "Document" : "Image"}</span>
        </button>
      </li>`;
    }),
  ].join("");
  const destination = folderOptions(listing.folders, openId);
  const browse = empty
    ? `<p class="w3-text-grey">This folder is empty.</p>`
    : `<ul class="w3-ul editor-library">${rows}</ul>`;
  return `<h1 class="w3-large">Library</h1>
    ${noticePanel(notice)}
    <div class="editor-library-split">
      <section class="editor-library-browse" aria-label="Folders and files">
        <p class="editor-crumbs">${crumbs}</p>
        <p><button type="button" class="w3-button w3-white" data-action="new-folder">New folder here</button></p>
        ${browse}
      </section>
      <div class="editor-library-panels">
        <section id="library-detail" class="w3-card w3-white w3-padding editor-card" aria-label="Details">
          <p><strong>Details</strong></p>
          <p class="w3-text-grey">Select a file to edit its name, title, and folder.</p>
        </section>
        <details id="library-add" class="w3-card w3-white editor-card editor-library-add"${addOpen ? " open" : ""}>
          <summary>Add files</summary>
          <form id="library-upload" class="w3-padding editor-drop">
            <p class="w3-text-grey">Drop files or a folder here, or choose them. Images and PDFs only.</p>
            <p>
              <input id="library-files" name="file" type="file" multiple />
              <input id="library-dir" name="dir" type="file" webkitdirectory />
            </p>
            <fieldset class="editor-fieldset">
              <legend>Put them in</legend>
              <p class="editor-check"><label><input type="radio" name="dest" value="uploads" checked /> Uploads</label></p>
              <p class="editor-check"><label><input type="radio" name="dest" value="existing"${here ? "" : " disabled"} /> This folder${here ? ` (${escapeHtml(here.id)})` : ""}</label></p>
              <p class="editor-check"><label><input type="radio" name="dest" value="choose" /> Existing folder</label>
                <select name="folderId" class="w3-select w3-border">${destination}</select></p>
              <p class="editor-check"><label><input type="radio" name="dest" value="new" /> New folder</label>
                <input name="folderTitle" class="w3-input w3-border" placeholder="Folder id" spellcheck="false" autocomplete="off" /></p>
            </fieldset>
            <p id="library-upload-status" class="w3-text-grey" hidden></p>
            <p><button type="submit" class="w3-button w3-theme">Add files</button></p>
          </form>
        </details>
      </div>
    </div>`;
}

function folderOptions(folders: FolderRow[], current: string | null): string {
  const options = folders
    .map((folder) => {
      const depth = breadcrumb(folders, folder.id).length - 1;
      const label = `${"· ".repeat(Math.max(0, depth))}${folder.id}`;
      return `<option value="${escapeHtml(folder.id)}"${folder.id === current ? " selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
  return options || `<option value="">No folders yet</option>`;
}

export function assetDetail(asset: AssetRow, folders: FolderRow[]): string {
  const options = folders
    .map(
      (folder) =>
        `<option value="${escapeHtml(folder.id)}"${folder.id === asset.folderId ? " selected" : ""}>${escapeHtml(folder.id)}</option>`,
    )
    .join("");
  return `<form id="asset-detail" data-asset="${escapeHtml(asset.id)}">
    <p><strong>Details</strong></p>
    <p><label>Name <input name="name" class="w3-input w3-border" value="${escapeHtml(asset.name)}" /></label></p>
    <p><label>Title <input name="title" class="w3-input w3-border" value="${escapeHtml(asset.title ?? "")}" /></label></p>
    <p><label>Alt <input name="alt" class="w3-input w3-border" value="${escapeHtml(asset.alt ?? "")}" /></label></p>
    <p><label>Caption <input name="caption" class="w3-input w3-border" value="${escapeHtml(asset.caption ?? "")}" /></label></p>
    <p><label>Folder <select name="folderId" class="w3-select w3-border">${options}</select></label></p>
    <p class="editor-actions">
      <button type="submit" class="w3-button w3-theme">Save</button>
      <button type="button" class="w3-button w3-white" data-delete-asset="${escapeHtml(asset.id)}">Delete</button>
    </p>
  </form>`;
}
