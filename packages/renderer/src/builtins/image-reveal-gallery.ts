import { normalizeSiteAssetUrl } from "../assets.js";
import { hrefForPage } from "../page-href.js";
import type { ComponentFn } from "../types.js";
import {
  clampPanelsPerRow,
  clampTitleSizeEm,
  registerImageRevealGalleryElement,
  type ImageRevealItem,
} from "./image-reveal-gallery-element.js";

function isExternalHref(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//");
}

function resolveHref(ctx: Parameters<ComponentFn>[0], href: string): string {
  const trimmed = href.trim();
  if (!trimmed || isExternalHref(trimmed)) return trimmed;
  return hrefForPage(ctx, trimmed);
}

function parseItemRow(row: unknown, index: number): ImageRevealItem | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  if (typeof o.url !== "string" || typeof o.href !== "string") return null;
  const id = typeof o.id === "string" ? o.id : `panel-${index}`;
  const title =
    typeof o.title === "string" ? o.title : typeof o.alt === "string" ? o.alt : undefined;
  return { id, url: o.url, href: o.href, title };
}

function itemsFromProps(props: Record<string, unknown>): ImageRevealItem[] {
  const raw = props.items;
  if (!Array.isArray(raw)) return [];
  const items: ImageRevealItem[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const parsed = parseItemRow(raw[i], i);
    if (parsed) items.push(parsed);
  }
  return items;
}

/**
 * Reveal banner: grid panels, hover grow, click to fill stage then navigate.
 *
 * Props: `items[]` ({ url, href, title? }), `width`, `height`, `panelsPerRow` (2–6),
 * `hoverExpand`, `hoverGap` (px left beside a grown panel, default 10), `navigateDelay`, `titleSize` (1–2 em).
 */
export const imageRevealGallery: ComponentFn = (ctx, props = {}) => {
  registerImageRevealGalleryElement();

  const width = typeof props.width === "number" ? props.width : Number(props.width) || 700;
  const height = typeof props.height === "number" ? props.height : Number(props.height) || 300;
  const panelsPerRow = clampPanelsPerRow(
    typeof props.panelsPerRow === "number" ? props.panelsPerRow : Number(props.panelsPerRow) || 3,
  );
  const hoverExpand =
    typeof props.hoverExpand === "number"
      ? props.hoverExpand
      : Number(props.hoverExpand) || 30;
  const hoverGapRaw = typeof props.hoverGap === "number" ? props.hoverGap : Number(props.hoverGap);
  const hoverGap = Number.isFinite(hoverGapRaw) ? Math.max(0, hoverGapRaw) : 10;
  const navigateDelay =
    typeof props.navigateDelay === "number"
      ? props.navigateDelay
      : Number(props.navigateDelay) || 2500;
  const titleSize = clampTitleSizeEm(
    typeof props.titleSize === "number" ? props.titleSize : Number(props.titleSize) || 1,
  );

  const items = itemsFromProps(props).map((item) => ({
    ...item,
    url: ctx.assetUrl ? ctx.assetUrl(normalizeSiteAssetUrl(item.url)) : normalizeSiteAssetUrl(item.url),
    href: resolveHref(ctx, item.href),
  }));

  if (!items.length) {
    return `<p class="w3-text-grey"><em>No reveal banner panels.</em></p>`;
  }

  const itemsAttr = ctx.escapeHtml(JSON.stringify(items));
  return `<tessera-image-reveal-gallery width="${width}" height="${height}" panels-per-row="${panelsPerRow}" hover-expand="${hoverExpand}" hover-gap="${hoverGap}" navigate-delay="${navigateDelay}" title-size="${titleSize}" items="${itemsAttr}"></tessera-image-reveal-gallery>`;
};

export function registerImageRevealGalleryComponents(
  define: (name: string, fn: ComponentFn) => unknown,
): void {
  registerImageRevealGalleryElement();
  define("imageRevealGallery", imageRevealGallery);
}
