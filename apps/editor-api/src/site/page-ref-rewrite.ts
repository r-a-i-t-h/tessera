import { rewritePageRefIds } from "@r-a-i-t-h/tessera-renderer";
import type { ZoneAuthoring } from "./document.js";

/** Rewrite durable page refs inside authored zone maps. */
export function rewriteZonesPageRefs(
  zones: Record<string, ZoneAuthoring> | undefined,
  from: string,
  to: string,
): { zones: Record<string, ZoneAuthoring> | undefined; changed: boolean } {
  if (!zones) return { zones, changed: false };
  let changed = false;
  const next: Record<string, ZoneAuthoring> = {};
  for (const [id, zone] of Object.entries(zones)) {
    if ("html" in zone && typeof zone.html === "string") {
      const html = rewritePageRefIds(zone.html, from, to);
      if (html !== zone.html) changed = true;
      next[id] = { ...zone, html };
      continue;
    }
    if ("blocks" in zone && Array.isArray(zone.blocks)) {
      const blocks = zone.blocks.map((block) => {
        if (block.type !== "text") return block;
        const html = rewritePageRefIds(block.html, from, to);
        if (html !== block.html) changed = true;
        return { ...block, html };
      });
      next[id] = { blocks };
      continue;
    }
    next[id] = zone;
  }
  return { zones: next, changed };
}

/**
 * Rewrite page-id href props (reveal banner panels, etc.) and nested objects.
 * Only string values under keys `href`, `pageId`, and `page` that exactly match `from`.
 */
export function rewritePageIdProps(value: unknown, from: string, to: string): { value: unknown; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const result = rewritePageIdProps(item, from, to);
      if (result.changed) changed = true;
      return result.value;
    });
    return { value: next, changed };
  }
  if (!value || typeof value !== "object") return { value, changed: false };
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((key === "href" || key === "pageId" || key === "page") && typeof child === "string" && child === from) {
      out[key] = to;
      changed = true;
      continue;
    }
    const result = rewritePageIdProps(child, from, to);
    if (result.changed) changed = true;
    out[key] = result.value;
  }
  return { value: out, changed };
}
