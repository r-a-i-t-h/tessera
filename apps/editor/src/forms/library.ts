import { escapeHtml, noticePanel } from "../dom.js";

export type FolderRow = {
  id: string;
  parentId: string | null;
  sort?: number;
  system?: boolean;
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
  width?: number;
  height?: number;
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

/** `null` = library root; otherwise `/`-separated folder ids from root to the open folder. */
export type LibraryBrowseId = string | null;

export function libraryRouteHash(browseId: LibraryBrowseId): string {
  if (!browseId) return "#/library";
  return `#/library/${browseId.split("/").map(encodeURIComponent).join("/")}`;
}

/** Canonical browse id from a folder’s parent chain. */
export function libraryBrowseId(folders: FolderRow[], folderId: string): string {
  const trail = breadcrumb(folders, folderId);
  if (!trail.length) return folderId;
  return trail.map((folder) => folder.id).join("/");
}

export function libraryFolderHash(folders: FolderRow[], folderId: string): string {
  if (!folders.some((folder) => folder.id === folderId)) return "#/library";
  return libraryRouteHash(libraryBrowseId(folders, folderId));
}

/** Align route id with the folder tree (e.g. `hall` → `uploads/hall`). */
export function libraryNormalizeBrowseId(folders: FolderRow[], openId: LibraryBrowseId): LibraryBrowseId {
  if (!openId) return null;
  const folderId = libraryOpenFolderId(openId);
  if (!folderId || !folders.some((folder) => folder.id === folderId)) return openId;
  return libraryBrowseId(folders, folderId);
}

export function libraryBrowseIdAfterDelete(
  folders: FolderRow[],
  openId: LibraryBrowseId,
  deletedId: string,
  parentId: string | null,
): LibraryBrowseId {
  if (libraryOpenFolderId(openId) !== deletedId) return openId;
  return parentId ? libraryBrowseId(folders, parentId) : null;
}

/** Folder id from a library route segment (`hall` or `uploads/hall`). */
export function libraryOpenFolderId(openId: string | null): string | null {
  if (!openId) return null;
  const parts = openId.split("/").filter((part) => part.length > 0);
  return parts.length ? parts[parts.length - 1]! : null;
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

export function breadcrumbForOpenId(folders: FolderRow[], openId: string | null): FolderRow[] {
  if (!openId) return [];
  const parts = openId.split("/").filter((part) => part.length > 0);
  if (parts.length <= 1) return breadcrumb(folders, openId);
  const trail: FolderRow[] = [];
  for (const part of parts) {
    const folder = folders.find((item) => item.id === part);
    if (!folder) break;
    trail.push(folder);
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

/** Every folder id nested under `rootId` (not including `rootId`). */
export function descendantFolderIds(folders: FolderRow[], rootId: string): Set<string> {
  const out = new Set<string>();
  const walk = (parentId: string) => {
    for (const folder of childFolders(folders, parentId)) {
      if (out.has(folder.id)) continue;
      out.add(folder.id);
      walk(folder.id);
    }
  };
  walk(rootId);
  return out;
}

export function parentFolderLabel(folders: FolderRow[], folderId: string | null): string {
  if (!folderId) return "Library root";
  return breadcrumb(folders, folderId)
    .map((folder) => folder.id)
    .join(" / ");
}

export function parentFolderOptions(folders: FolderRow[], folder: FolderRow): string {
  const blocked = descendantFolderIds(folders, folder.id);
  blocked.add(folder.id);
  const rootSelected = folder.parentId === null ? " selected" : "";
  const rootOption = `<option value=""${rootSelected}>Library root</option>`;
  const options = folders
    .filter((item) => !blocked.has(item.id))
    .map((item) => {
      const depth = breadcrumb(folders, item.id).length - 1;
      const label = `${"· ".repeat(Math.max(0, depth))}${item.id}`;
      const selected = item.id === folder.parentId ? " selected" : "";
      return `<option value="${escapeHtml(item.id)}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");
  return `${rootOption}${options}`;
}

export function renderLibrary(listing: LibraryListing, openId: string | null, notice = "", addOpen = true): string {
  const trail = breadcrumbForOpenId(listing.folders, openId);
  const openFolderId = libraryOpenFolderId(openId);
  const here = openFolderId ? listing.folders.find((folder) => folder.id === openFolderId) : undefined;
  const crumbs = [
    `<a href="#/library">Library root</a>`,
    ...trail.map((folder, index) => {
      const href = libraryFolderHash(listing.folders, folder.id);
      const current = index === trail.length - 1 ? ` data-library-crumb="current"` : "";
      return `<a href="${href}"${current}>${escapeHtml(folder.id)}</a>`;
    }),
  ].join(" / ");
  const folders = childFolders(listing.folders, openFolderId);
  const assets = childAssets(listing.assets, openFolderId);
  const empty = !folders.length && !assets.length;
  const rows = [
    ...folders.map(
      (folder) => `<li class="editor-library-row">
        <a class="editor-library-name" href="${libraryFolderHash(listing.folders, folder.id)}">${escapeHtml(folder.id)}</a>
        <span class="w3-text-grey w3-small">${folder.system ? "System folder" : "Folder"}</span>
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
          <span class="editor-library-name">${escapeHtml(assetLabel(asset))}</span>
          <span class="w3-text-grey w3-small">${asset.kind === "document" ? "Document" : "Image"}</span>
        </button>
      </li>`;
    }),
  ].join("");
  const destination = folderOptions(listing.folders, openFolderId);
  const browse = empty
    ? `<p class="w3-text-grey">This folder is empty.</p>`
    : `<ul class="w3-ul editor-library">${rows}</ul>`;
  return `<h1 class="w3-large">Library</h1>
    ${noticePanel(notice)}
    <div class="editor-library-split">
      <section class="editor-library-browse" aria-label="Folders and files">
        <p class="editor-crumbs">${crumbs}</p>
        <p>
          <button type="button" class="w3-button w3-white" data-action="new-folder">New folder here</button>
          <button type="button" class="w3-button w3-white" data-action="rescan">Rescan</button>
        </p>
        ${browse}
      </section>
      <div class="editor-library-panels">
        <section id="library-detail" class="w3-card w3-white w3-padding editor-card" aria-label="Details">
          <p><strong>Details</strong></p>
        </section>
        <details id="library-add" class="w3-card w3-white editor-card editor-library-add"${addOpen ? " open" : ""}>
          <summary>Add files</summary>
          <form id="library-upload" class="w3-padding editor-drop">
            <p>
              <input id="library-files" name="file" type="file" multiple />
              <input id="library-dir" name="dir" type="file" webkitdirectory />
            </p>
            <fieldset class="editor-fieldset">
              <legend>Put them in</legend>
              <p class="editor-check"><label><input type="radio" name="dest" value="uploads" checked /> Uploads</label></p>
              <p class="editor-check"><label><input type="radio" name="dest" value="choose"${listing.folders.length ? "" : " disabled"} /> Existing folder</label>
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

function assetLabel(asset: AssetRow): string {
  return asset.width && asset.height ? `${asset.name} (${asset.width}x${asset.height})` : asset.name;
}

function assetSize(asset: AssetRow): string {
  if (asset.kind !== "image" || !asset.width || !asset.height) return "";
  return `<p>${asset.width} x ${asset.height}</p>
    <p><button type="button" class="w3-button w3-white" data-preview-asset="${escapeHtml(asset.id)}">Preview</button></p>`;
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

export function folderDetail(folder: FolderRow, folders: FolderRow[]): string {
  if (folder.system) {
    return `<div id="folder-detail" data-folder="${escapeHtml(folder.id)}">
    <p><strong>Details</strong></p>
    <p><strong>Folder id</strong> ${escapeHtml(folder.id)}</p>
    <p><strong>Parent</strong> ${escapeHtml(parentFolderLabel(folders, folder.parentId))}</p>
    <p class="w3-text-grey w3-small">System folders cannot be moved or renamed.</p>
  </div>`;
  }
  return `<form id="folder-detail" data-folder="${escapeHtml(folder.id)}">
    <p><strong>Details</strong></p>
    <p><label>Folder id <input name="nextId" class="w3-input w3-border" value="${escapeHtml(folder.id)}" autocomplete="off" spellcheck="false" /></label></p>
    <p><label>Parent folder <select name="parentId" class="w3-select w3-border">${parentFolderOptions(folders, folder)}</select></label></p>
    <p class="editor-actions">
      <button type="submit" class="w3-button w3-theme">Save</button>
      <button type="button" class="w3-button w3-white" data-delete-folder="${escapeHtml(folder.id)}">Delete</button>
    </p>
  </form>`;
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
    ${assetSize(asset)}
    <p class="editor-actions">
      <button type="submit" class="w3-button w3-theme">Save</button>
      <button type="button" class="w3-button w3-white" data-delete-asset="${escapeHtml(asset.id)}">Delete</button>
    </p>
  </form>`;
}
