import type { Block, LayoutNode, Media, SiteDocument } from "@r-a-i-t-h/tessera-model";
import { resolvePageProfile } from "@r-a-i-t-h/tessera-model";
import { normalizeSiteAssetUrl, rewriteMediaUrls } from "./assets.js";
import { expandMustache, renderNamed } from "./bindings.js";
import { expandPageElements } from "./page-elements.js";
import type { ComponentRegistry } from "./registry.js";
import { indexDocument, mergeZones } from "./merge.js";
import type { MicroAppMount, RenderContext, ZoneMap } from "./types.js";

export type Skin = {
  /** Map a region role + optional className to a final class string. */
  regionClass?: (role: string | undefined, className: string | undefined) => string;
};

export type RenderPageOptions = {
  document: SiteDocument;
  pageId: string;
  registry: ComponentRegistry;
  skin?: Skin;
  /**
   * Leave bindings and components as empty micro-app mounts.
   * Recorded mounts are appended to `microApps` when that array is passed.
   */
  mountMicroApps?: boolean;
  microApps?: MicroAppMount[];
  /** Pages dist. Snapshot leaves this unset. */
  pageHref?: (pageId: string) => string;
  /**
   * Applied after `normalizeSiteAssetUrl`. Pages publish passes `assetHref`
   * so nested HTML files reach `media/` at the site root.
   */
  assetUrl?: (url: string) => string;
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mediaToHtml(media: Media | undefined, assetUrl: (url: string) => string): string {
  if (!media) return "";
  const alt = escapeHtml(media.alt ?? media.title ?? "");
  const src = escapeHtml(assetUrl(media.url));
  const label = escapeHtml(media.title ?? media.alt ?? media.id);
  if (media.type === "document" || media.type === "pdf") {
    return `<a href="${src}" download>${label}</a>`;
  }
  return `<img src="${src}" alt="${alt}" />`;
}

function imageBlockToHtml(
  block: { url: string; alt?: string; caption?: string },
  assetUrl: (url: string) => string,
): string {
  const alt = escapeHtml(block.alt ?? block.caption ?? "");
  const src = escapeHtml(assetUrl(block.url));
  return `<img src="${src}" alt="${alt}" />`;
}

function zoneJsonFromMap(zones: ZoneMap, zoneId: string): unknown[] {
  const blocks = zones.get(zoneId) ?? [];
  const out: unknown[] = [];
  for (const b of blocks) {
    if (b.type !== "json") continue;
    if (Array.isArray(b.data)) out.push(...b.data);
    else out.push(b.data);
  }
  return out;
}

export function renderPage(options: RenderPageOptions): string {
  const { document, pageId, registry, skin } = options;
  const { layoutsById, pagesById, itemsById, mediaById } = indexDocument(document);

  const page = pagesById.get(pageId);
  if (!page) throw new Error(`Unknown page: ${pageId}`);

  const profile = resolvePageProfile(document, page);
  const layout = layoutsById.get(profile.layoutId);
  if (!layout) throw new Error(`Unknown layout: ${profile.layoutId} (page ${pageId})`);

  const zones = mergeZones(document, page, itemsById);

  const assetUrl = (url: string) => {
    const normalized = normalizeSiteAssetUrl(url);
    return options.assetUrl ? options.assetUrl(normalized) : normalized;
  };

  const ctx: RenderContext = {
    document,
    page,
    profile,
    zones,
    registry,
    renderBlocks: (blocks) => renderBlocks(blocks, ctx),
    zoneJson: <T = unknown>(zoneId: string) => zoneJsonFromMap(zones, zoneId) as T[],
    mediaHtml: (id) => mediaToHtml(mediaById.get(id), assetUrl),
    escapeHtml,
    mountMicroApps: options.mountMicroApps,
    microApps: options.microApps,
    pageHref: options.pageHref,
    assetUrl,
  };

  const pageHtml = renderNode(layout.root, ctx, skin);
  const masterId = document.site.masterLayoutId;
  if (!masterId || masterId === profile.layoutId) return pageHtml;
  const master = layoutsById.get(masterId);
  if (!master) throw new Error(`Unknown master layout: ${masterId}`);
  return renderNode(master.root, ctx, skin, pageHtml);
}

function renderBlocks(blocks: Block[], ctx: RenderContext): string {
  return blocks.map((b) => renderBlock(b, ctx)).join("");
}

function renderBlock(block: Block, ctx: RenderContext): string {
  switch (block.type) {
    case "text":
      return authoredHtml(block.html, ctx);
    case "json":
      return "";
    case "media":
      return ctx.mediaHtml(block.id);
    case "image":
      return imageBlockToHtml(block, ctx.assetUrl ?? ((url) => url));
    case "component":
      return renderNamed(block.name, ctx, block.props ?? {});
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

function authoredHtml(html: string, ctx: RenderContext): string {
  const expanded = expandPageElements(expandMustache(html, ctx), ctx);
  return rewriteMediaUrls(expanded, ctx.assetUrl ?? ((url) => url));
}

function renderNode(node: LayoutNode, ctx: RenderContext, skin?: Skin, pageHtml?: string): string {
  switch (node.type) {
    case "static":
      return authoredHtml(node.html, ctx);
    case "zone": {
      const blocks = ctx.zones.get(node.id) ?? [];
      const field = ctx.page.fields?.[node.id];
      const inner = renderBlocks(blocks, ctx) || (field ? escapeHtml(field) : "");
      if (!inner) return "";
      if (node.className) return `<div class="${escapeHtml(node.className)}">${inner}</div>`;
      return inner;
    }
    case "region": {
      const tag = node.tag ?? "div";
      const cls =
        skin?.regionClass?.(node.role, node.className) ??
        [node.className, node.role ? `rt-role-${node.role}` : ""].filter(Boolean).join(" ");
      const children = node.children.map((c) => renderNode(c, ctx, skin, pageHtml)).join("");
      // Skip empty wrappers (e.g. unused primary column on pages that only fill main).
      if (!children) return "";
      const idAttr = node.id ? ` id="${escapeHtml(node.id)}"` : "";
      const classAttr = cls ? ` class="${escapeHtml(cls)}"` : "";
      return `<${tag}${idAttr}${classAttr}>${children}</${tag}>`;
    }
    case "page":
      return pageHtml ?? "";
    case "component": {
      const childrenHtml = (node.children ?? []).map((c) => renderNode(c, ctx, skin, pageHtml)).join("");
      return renderNamed(node.name, ctx, node.props ?? {}, childrenHtml);
    }
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

export function resolvePageId(document: SiteDocument, hashOrId?: string): string {
  const raw = (hashOrId ?? "").replace(/^#/, "").trim();
  if (raw && document.pages.some((p) => p.id === raw)) return raw;
  if (document.pages.some((p) => p.id === document.site.homePageId)) {
    return document.site.homePageId;
  }
  return document.pages[0]!.id;
}
