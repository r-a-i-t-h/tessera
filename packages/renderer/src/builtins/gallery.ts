import { captionFromFilename, type Folder, type SiteDocument } from "@r-a-i-t-h/tessera-model";
import { normalizeSiteAssetUrl } from "../assets.js";
import type { ComponentFn } from "../types.js";
import { registerGalleryElement, type GalleryItem } from "./gallery-element.js";

export type GallerySlide = {
  url: string;
  caption?: string;
  alt?: string;
  /** Source filename when from a folder (used for filter). */
  file?: string;
};

function folderById(document: SiteDocument): Map<string, Folder> {
  return new Map((document.folders ?? []).map((f) => [f.id, f]));
}

function joinPath(dir: string, file: string): string {
  return `${dir.replace(/\/$/, "")}/${file.replace(/^\.\//, "")}`;
}

/** Slides from one or more first-class folder records (concat in folder order). */
export function slidesFromFolders(
  document: SiteDocument,
  folderIds: string[],
  filter?: string | RegExp,
): GallerySlide[] {
  const re =
    filter === undefined || filter === ""
      ? null
      : typeof filter === "string"
        ? new RegExp(filter)
        : filter;
  const byId = folderById(document);
  const slides: GallerySlide[] = [];

  for (const id of folderIds) {
    const folder = byId.get(id);
    if (!folder) continue;
    for (const img of folder.images) {
      if (re && !re.test(img.file)) continue;
      const caption = img.caption ?? captionFromFilename(img.file);
      const raw = img.url ?? joinPath(folder.path, img.file);
      slides.push({
        file: img.file,
        url: normalizeSiteAssetUrl(raw),
        caption,
        alt: img.alt ?? caption,
      });
    }
  }
  return slides;
}

function folderIdsFromProps(props: Record<string, unknown>): string[] {
  const raw = props.folders ?? props.folder;
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  return [];
}

function slidesToItems(slides: GallerySlide[]): GalleryItem[] {
  return slides.map((s, i) => ({
    id: s.file ? `${s.file}-${i}` : `slide-${i}`,
    url: s.url,
    alt: s.alt ?? "",
    caption: s.caption ?? "",
  }));
}

/**
 * Gallery from library folder id(s).
 *
 * Props:
 * - `folders` / `folder` — first-class folder id(s); optional `filter` regex on filename
 * - `mode` — `grid` | `slides`; `autoplay`
 */
export const gallery: ComponentFn = (ctx, props = {}) => {
  registerGalleryElement();

  const mode = props.mode === "slides" ? "slides" : "grid";
  const autoplay = props.autoplay === true || props.autoplay === "true";
  const folderIds = folderIdsFromProps(props);
  const filter = typeof props.filter === "string" ? props.filter : undefined;
  const slides = folderIds.length ? slidesFromFolders(ctx.document, folderIds, filter) : [];

  const items = slidesToItems(slides).map((item) => ({
    ...item,
    url: ctx.assetUrl ? ctx.assetUrl(item.url) : item.url,
  }));
  if (!items.length) {
    return `<p class="w3-text-grey"><em>No gallery images.</em></p>`;
  }

  const itemsAttr = ctx.escapeHtml(JSON.stringify(items));
  const autoplayAttr = autoplay ? ` autoplay=""` : "";
  return `<tessera-gallery mode="${mode}" items="${itemsAttr}"${autoplayAttr}></tessera-gallery>`;
};

export function registerGalleryComponents(
  define: (name: string, fn: ComponentFn) => unknown,
): void {
  registerGalleryElement();
  define("gallery", gallery);
}
