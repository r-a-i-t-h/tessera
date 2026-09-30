import type { RenderContext } from "./types.js";

/** `#id` in the snapshot. A pages dist supplies `ctx.pageHref`. */
export function hrefForPage(ctx: RenderContext, pageId: string): string {
  if (!pageId) return "#";
  return ctx.pageHref?.(pageId) ?? `#${pageId}`;
}
