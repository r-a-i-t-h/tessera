import {
  captionFromFilename,
  type Block,
  type Folder,
  type SiteDocument,
} from "@r-a-i-t-h/tessera-model";
import { normalizeSiteAssetUrl } from "../assets.js";
import type { ComponentFn, ZoneMap } from "../types.js";
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
      slides.push({
        file: img.file,
        url: normalizeSiteAssetUrl(joinPath(folder.path, img.file)),
        caption,
        alt: img.alt ?? caption,
      });
    }
  }
  return slides;
}

/** Slides from explicit `image` blocks in a zone (document order). */
export function slidesFromImageBlocks(blocks: Block[] | undefined): GallerySlide[] {
  if (!blocks?.length) return [];
  const slides: GallerySlide[] = [];
  for (const b of blocks) {
    if (b.type !== "image") continue;
    const caption = b.caption ?? captionFromFilename(b.url.split("/").pop() ?? b.url);
    slides.push({
      url: normalizeSiteAssetUrl(b.url),
      caption,
      alt: b.alt ?? caption,
    });
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
 * Gallery from folder id(s) and/or inline `image` blocks in a zone.
 *
 * Props:
 * - `folders` / `folder` — first-class folder id(s); optional `filter` regex on filename
 * - `fromZone` — zone of `image` blocks (default `slides` when no folders)
 * - `mode` — `grid` | `slides`; `autoplay`
 */
export const gallery: ComponentFn = (ctx, props = {}) => {
  registerGalleryElement();

  const mode = props.mode === "slides" ? "slides" : "grid";
  const autoplay = props.autoplay === true || props.autoplay === "true";
  const folderIds = folderIdsFromProps(props);
  const filter = typeof props.filter === "string" ? props.filter : undefined;
  const fromZone = typeof props.fromZone === "string" ? props.fromZone : "slides";

  let slides: GallerySlide[] = [];
  if (folderIds.length) {
    slides = slidesFromFolders(ctx.document, folderIds, filter);
  } else {
    slides = slidesFromImageBlocks(ctx.zones.get(fromZone));
  }

  const items = slidesToItems(slides);
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

/** Merge nested component-block zones into a zone map (for inline gallery slides). */
export function mergeNestedZones(base: ZoneMap, nested?: Record<string, Block[]>): ZoneMap {
  if (!nested) return base;
  const out = new Map(base);
  for (const [id, blocks] of Object.entries(nested)) {
    out.set(id, blocks);
  }
  return out;
}
