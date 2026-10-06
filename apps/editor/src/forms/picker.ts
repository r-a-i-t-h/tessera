import { escapeHtml } from "../dom.js";
import type { AssetRow, FolderRow, LibraryListing } from "./library.js";

export type PickerMode = "image" | "document" | "folder";

export type PickedAsset = {
  id: string;
  kind: "image" | "document";
  name: string;
  url: string;
  alt?: string;
  title?: string;
  caption?: string;
};

export function imageTag(asset: PickedAsset): string {
  const alt = asset.alt || asset.title || asset.name;
  return `<img src="${asset.url}" alt="${alt}" />`;
}

export function documentLink(asset: PickedAsset): string {
  const label = asset.title || asset.name;
  return `<a href="${asset.url}">${label}</a>`;
}

export function mediaBlockSnippet(asset: PickedAsset): string {
  return `- type: media\n  id: ${asset.id}\n`;
}

export function imageSlideSnippet(asset: PickedAsset): string {
  const alt = asset.alt || asset.title || asset.name;
  const caption = asset.caption || asset.title || "";
  const lines = [`- type: image`, `  url: ${asset.url}`, `  alt: ${alt}`];
  if (caption) lines.push(`  caption: ${caption}`);
  return `${lines.join("\n")}\n`;
}

export function renderPicker(listing: LibraryListing, mode: PickerMode, openId: string | null): string {
  const folders = listing.folders.filter((folder) => folder.parentId === openId);
  const assets = listing.assets.filter((asset) => asset.folderId === openId && (mode === "folder" || asset.kind === mode));
  const folderButtons = folders
    .map(
      (folder) =>
        `<button type="button" class="w3-button w3-white" data-open-folder="${escapeHtml(folder.id)}">${escapeHtml(folder.id)}</button>${
          mode === "folder"
            ? `<button type="button" class="w3-button w3-theme" data-pick-folder="${escapeHtml(folder.id)}">Choose</button>`
            : ""
        }`,
    )
    .join("");
  const cells =
    mode === "image"
      ? assets
          .map(
            (asset) => `<button type="button" class="editor-pick-cell" data-pick-asset="${escapeHtml(asset.id)}">
              <img src="/api/library/assets/${encodeURIComponent(asset.id)}/thumb" alt="" />
              <span>${escapeHtml(asset.name)}</span>
            </button>`,
          )
          .join("")
      : assets
          .map(
            (asset) =>
              `<button type="button" class="w3-button w3-white" data-pick-asset="${escapeHtml(asset.id)}">${escapeHtml(asset.name)}</button>`,
          )
          .join("");
  const tabs = (["image", "document", "folder"] as const)
    .map(
      (item) =>
        `<button type="button" class="w3-button ${item === mode ? "w3-theme" : "w3-white"}" data-picker-mode="${item}">${item === "image" ? "Images" : item === "document" ? "Documents" : "Folders"}</button>`,
    )
    .join("");
  return `<div class="editor-picker" data-picker-open="${openId ?? ""}">
    <p class="editor-tabs">${tabs}</p>
    <p>${folderButtons || ""}</p>
    <div class="${mode === "image" ? "editor-pick-grid" : "editor-pick-list"}">${cells}</div>
  </div>`;
}

export function folderChecklist(folders: FolderRow[], selected: string[]): string {
  return folders
    .map((folder) => {
      const checked = selected.includes(folder.id) ? " checked" : "";
      return `<p class="editor-check"><label><input type="checkbox" data-folder-id="${escapeHtml(folder.id)}"${checked} /> ${escapeHtml(folder.id)}</label></p>`;
    })
    .join("");
}

export function checkedFolderIds(marked: { id: string; checked: boolean }[]): string[] {
  return marked.filter((item) => item.checked).map((item) => item.id);
}

export function foldersValue(ids: string[]): string | string[] | undefined {
  if (!ids.length) return undefined;
  if (ids.length === 1) return ids[0];
  return ids;
}
