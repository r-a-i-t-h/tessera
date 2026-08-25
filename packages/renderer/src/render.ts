import type { Block, LayoutNode, Media, Page, SiteDocument } from "@r-a-i-t-h/tessera-model";
import { normalizeSiteAssetUrl } from "./assets.js";
import { expandMustache, renderNamed } from "./bindings.js";
import type { ComponentRegistry } from "./registry.js";
import { indexDocument, mergeZones } from "./merge.js";
import type { RenderContext, ZoneMap } from "./types.js";

export type Skin = {
  /** Map a region role + optional className to a final class string. */
  regionClass?: (role: string | undefined, className: string | undefined) => string;
};

export type RenderPageOptions = {
  document: SiteDocument;
  pageId: string;
  registry: ComponentRegistry;
  skin?: Skin;
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mediaToHtml(media: Media | undefined): string {
  if (!media) return "";
  const alt = escapeHtml(media.alt ?? media.title ?? "");
  const src = escapeHtml(normalizeSiteAssetUrl(media.url));
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

  const layout = layoutsById.get(page.layoutId);
  if (!layout) throw new Error(`Unknown layout: ${page.layoutId} (page ${pageId})`);

  const zones = mergeZones(document, page, itemsById);

  const ctx: RenderContext = {
    document,
    page,
    zones,
    registry,
    renderBlocks: (blocks) => renderBlocks(blocks, ctx),
    zoneJson: <T = unknown>(zoneId: string) => zoneJsonFromMap(zones, zoneId) as T[],
    mediaHtml: (id) => mediaToHtml(mediaById.get(id)),
    escapeHtml,
  };

  return renderNode(layout.root, ctx, skin);
}

function renderBlocks(blocks: Block[], ctx: RenderContext): string {
  return blocks.map((b) => renderBlock(b, ctx)).join("");
}

function renderBlock(block: Block, ctx: RenderContext): string {
  switch (block.type) {
    case "text":
      return expandMustache(block.html, ctx);
    case "json":
      return "";
    case "media":
      return ctx.mediaHtml(block.id);
    case "component":
      return renderNamed(block.name, ctx, block.props ?? {});
    default: {
      const _exhaustive: never = block;
      return _exhaustive;
    }
  }
}

function renderNode(node: LayoutNode, ctx: RenderContext, skin?: Skin): string {
  switch (node.type) {
    case "static":
      return expandMustache(node.html, ctx);
    case "zone": {
      const blocks = ctx.zones.get(node.id) ?? [];
      const inner = renderBlocks(blocks, ctx);
      if (!inner) return "";
      if (node.className) return `<div class="${escapeHtml(node.className)}">${inner}</div>`;
      return inner;
    }
    case "region": {
      const tag = node.tag ?? "div";
      const cls =
        skin?.regionClass?.(node.role, node.className) ??
        [node.className, node.role ? `rt-role-${node.role}` : ""].filter(Boolean).join(" ");
      const children = node.children.map((c) => renderNode(c, ctx, skin)).join("");
      // Skip empty wrappers (e.g. unused primary column on pages that only fill main).
      if (!children) return "";
      const classAttr = cls ? ` class="${escapeHtml(cls)}"` : "";
      return `<${tag}${classAttr}>${children}</${tag}>`;
    }
    case "component": {
      const childrenHtml = (node.children ?? []).map((c) => renderNode(c, ctx, skin)).join("");
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
