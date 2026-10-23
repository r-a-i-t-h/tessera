import type { LibraryAsset } from "../api.js";
import { escapeHtml } from "../dom.js";
import { editorMediaSrc } from "../forms/media-url.js";

export function assetDisplayHtml(assetId: string, assets: readonly LibraryAsset[]): string {
  const asset = assets.find((a) => a.id === assetId);
  if (!asset) return escapeHtml(assetId);
  const label = asset.title?.trim() || asset.name;
  const url = editorMediaSrc(asset.url);
  if (asset.kind === "image") {
    return `<a class="editor-dataset-asset" href="${escapeHtml(url)}" target="_blank" rel="noopener"><img class="editor-dataset-asset-thumb" src="${escapeHtml(url)}" alt="" loading="lazy" /><span>${escapeHtml(label)}</span></a>`;
  }
  return `<a class="editor-dataset-asset" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
}
