import type { Media } from "@r-a-i-t-h/tessera-model";
import { normalizeSiteAssetUrl } from "../assets.js";
import type { ComponentFn } from "../types.js";
import { registerGalleryElement, type GalleryItem } from "./gallery-element.js";

/**
 * Resolve ordered media ids from a JSON zone.
 * Accepts: string ids, `{ id }`, or a single `{ mediaIds: string[] }` object.
 */
export function resolveGalleryMediaIds(raw: unknown[]): string[] {
  if (raw.length === 1 && raw[0] && typeof raw[0] === "object" && !Array.isArray(raw[0])) {
    const obj = raw[0] as Record<string, unknown>;
    if (Array.isArray(obj.mediaIds)) {
      return obj.mediaIds.filter((x): x is string => typeof x === "string");
    }
  }
  const ids: string[] = [];
  for (const row of raw) {
    if (typeof row === "string") ids.push(row);
    else if (row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string") {
      ids.push((row as { id: string }).id);
    }
  }
  return ids;
}

function mediaToItem(media: Media): GalleryItem {
  return {
    id: media.id,
    url: normalizeSiteAssetUrl(media.url),
    alt: media.alt ?? media.title ?? "",
    caption: media.caption ?? media.title ?? "",
  };
}

/**
 * Gallery from catalog + ordered media ids in a JSON zone (via binding or props.fromZone).
 */
export const gallery: ComponentFn = (ctx, props = {}) => {
  registerGalleryElement();

  const fromZone = typeof props.fromZone === "string" ? props.fromZone : "slides";
  const mode = props.mode === "slides" ? "slides" : "grid";
  const autoplay = props.autoplay === true || props.autoplay === "true";

  const ids = resolveGalleryMediaIds(ctx.zoneJson(fromZone));
  const byId = new Map(ctx.document.media.map((m) => [m.id, m]));

  const resolved = ids
    .map((id) => byId.get(id))
    .filter((m): m is Media => Boolean(m));

  const anySort = resolved.some((m) => m.sort !== undefined);
  if (anySort) {
    resolved.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id.localeCompare(b.id));
  }

  const items = resolved.map(mediaToItem);

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
