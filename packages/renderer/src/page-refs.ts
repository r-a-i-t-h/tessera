import type { RenderContext } from "./types.js";
import { hrefForPage } from "./page-href.js";

const PAGE_ATTR = "data-tessera-page";
const MISSING_CLASS = "tessera-page-missing";

/**
 * Resolve authored `<a data-tessera-page="id">` anchors to real hrefs.
 * Missing targets keep a placeholder href and gain `tessera-page-missing`.
 */
export function resolvePageRefs(html: string, ctx: RenderContext): string {
  if (!html.includes(PAGE_ATTR)) return html;

  const pageIds = new Set(ctx.document.pages.map((p) => p.id));
  return html.replace(/<a\b([^>]*)>/gi, (full, attrs: string) => {
    const pageId = attrValue(attrs, PAGE_ATTR);
    if (pageId === undefined) return full;

    const id = pageId.trim();
    if (!id) return full;

    let nextAttrs = attrs;
    if (pageIds.has(id)) {
      const href = hrefForPage(ctx, id);
      nextAttrs = setAttr(nextAttrs, "href", href);
      nextAttrs = removeClass(nextAttrs, MISSING_CLASS);
    } else {
      nextAttrs = setAttr(nextAttrs, "href", "#");
      nextAttrs = addClass(nextAttrs, MISSING_CLASS);
    }
    return `<a${nextAttrs}>`;
  });
}

/** Rewrite `data-tessera-page` values in HTML when a page id changes. */
export function rewritePageRefIds(html: string, from: string, to: string): string {
  if (!html.includes(PAGE_ATTR) || from === to) return html;
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(`(\\bdata-tessera-page\\s*=\\s*)(["'])${escaped}\\2`, "gi"),
    `$1$2${to}$2`,
  );
}

function attrValue(attrs: string, name: string): string | undefined {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i");
  const m = attrs.match(re);
  return m ? m[2] : undefined;
}

function setAttr(attrs: string, name: string, value: string): string {
  const re = new RegExp(`(\\s${name}\\s*=\\s*)(["'])[\\s\\S]*?\\2`, "i");
  const encoded = escapeAttr(value);
  if (re.test(attrs)) return attrs.replace(re, `$1$2${encoded}$2`);
  return `${attrs} ${name}="${encoded}"`;
}

function addClass(attrs: string, className: string): string {
  const existing = attrValue(attrs, "class");
  if (existing === undefined) return setAttr(attrs, "class", className);
  const parts = existing.split(/\s+/).filter(Boolean);
  if (parts.includes(className)) return attrs;
  return setAttr(attrs, "class", [...parts, className].join(" "));
}

function removeClass(attrs: string, className: string): string {
  const existing = attrValue(attrs, "class");
  if (existing === undefined) return attrs;
  const next = existing
    .split(/\s+/)
    .filter((c) => c && c !== className)
    .join(" ");
  if (!next) {
    return attrs.replace(/(?:\s)class\s*=\s*(["'])[\s\S]*?\1/i, "");
  }
  return setAttr(attrs, "class", next);
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
