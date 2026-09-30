import { gallery } from "./builtins/gallery.js";
import { subpageList } from "./builtins/nav.js";
import type { RenderContext } from "./types.js";

const MARKER = /<(nav|div)\b[^>]*\bdata-tessera="(subpages|gallery)"[^>]*>(?:\s*)<\/\1>/gi;

/** Replace subpages and gallery markers left in authored HTML. */
export function expandPageElements(html: string, ctx: RenderContext): string {
  return html.replace(MARKER, (full, _tag: string, kind: string) => {
    if (kind === "subpages") return subpageList(ctx, { title: attr(full, "data-title") }) ?? "";
    if (kind === "gallery") {
      const mode = attr(full, "data-mode") === "slides" ? "slides" : "grid";
      return gallery(ctx, { folders: [attr(full, "data-folder")], mode }) ?? "";
    }
    return full;
  });
}

function attr(tag: string, name: string): string {
  const match = new RegExp(`\\b${name}="([^"]*)"`, "i").exec(tag);
  return match ? decodeAttr(match[1] ?? "") : "";
}

function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
