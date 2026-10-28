import { collectDeclaredZones, type LayoutNode } from "@r-a-i-t-h/tessera-model";
import { compileWidgetsToHtml } from "@r-a-i-t-h/tessera-sections";
import { isWidgetBlocks } from "../compose/draft.js";

/** A zone id safe to use as a form path (`zones.<id>.html` splits on dots). */
const ZONE_ID = /^[A-Za-z][A-Za-z0-9_-]*$/;

export type ItemContent = "html" | "component";

export type ItemZone = { html: string } | { component: string; props?: Record<string, unknown> };

export type NewItemBody = {
  id: string;
  zones: Record<string, ItemZone>;
};

/** Zone ids declared by these layouts, in layout order. A repeated id is kept once. */
export function zonesDeclaredBy(roots: readonly LayoutNode[]): string[] {
  const seen = new Set<string>();
  for (const root of roots) {
    for (const id of collectDeclaredZones(root)) seen.add(id);
  }
  return [...seen];
}

export function itemZoneError(zone: string): string | undefined {
  const name = zone.trim();
  if (!name) return undefined;
  if (!ZONE_ID.test(name)) {
    return "Zone must start with a letter, then only letters, numbers, hyphens, or underscores.";
  }
  return undefined;
}

export function itemContent(value: string): ItemContent {
  if (value === "component") return value;
  return "html";
}

/** A shared item that fills one layout zone. A blank zone fills none. */
export function newItemBody(id: string, zone: string, content: ItemContent = "html", componentName = ""): NewItemBody {
  const name = zone.trim();
  if (!name) return { id: id.trim(), zones: {} };
  return {
    id: id.trim(),
    zones: { [name]: zoneFor(content, componentName) },
  };
}

function zoneFor(content: ItemContent, componentName: string): ItemZone {
  if (content === "component") return { component: componentName.trim() };
  return { html: "" };
}

/**
 * Blank component props are omitted.
 */
export function tidyItemRecord(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const record = data as Record<string, unknown>;
  const zones = record.zones;
  if (!zones || typeof zones !== "object" || Array.isArray(zones)) return data;
  const next: Record<string, unknown> = {};
  for (const [id, zone] of Object.entries(zones)) next[id] = tidyZone(zone);
  return { ...record, zones: next };
}

function tidyZone(zone: unknown): unknown {
  if (!zone || typeof zone !== "object" || Array.isArray(zone)) return zone;
  const row = { ...(zone as Record<string, unknown>) };
  if ("component" in row && row.props === null) delete row.props;
  return row;
}

/** Drop unsupported zone shapes and rewrite mistaken widget blocks to html for the item editor. */
export function normalizeItemZones(record: Record<string, unknown>): Record<string, unknown> {
  const zones = record.zones;
  if (!zones || typeof zones !== "object" || Array.isArray(zones)) return record;
  const next: Record<string, unknown> = {};
  for (const [id, zone] of Object.entries(zones as Record<string, unknown>)) {
    const normalized = normalizeItemZone(zone);
    if (normalized !== undefined) next[id] = normalized;
  }
  if (JSON.stringify(next) === JSON.stringify(zones)) return record;
  return { ...record, zones: next };
}

function legacyBlocksToHtml(blocks: unknown[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const row = block as Record<string, unknown>;
    if (row.type === "text" && typeof row.html === "string") parts.push(row.html);
  }
  return parts.join("");
}

function blocksToItemHtml(blocks: unknown[]): string {
  if (isWidgetBlocks(blocks)) {
    const widgets = blocks as { kind: string; html?: string }[];
    if (widgets.length === 1 && widgets[0]?.kind === "text" && typeof widgets[0].html === "string") {
      return widgets[0].html;
    }
    return compileWidgetsToHtml(blocks as never[]);
  }
  return legacyBlocksToHtml(blocks);
}

function normalizeItemZone(zone: unknown): unknown | undefined {
  if (!zone || typeof zone !== "object" || Array.isArray(zone)) return zone;
  const row = zone as Record<string, unknown>;
  if ("json" in row) return undefined;
  if ("blocks" in row && Array.isArray(row.blocks)) {
    return { html: blocksToItemHtml(row.blocks) };
  }
  if ("html" in row && typeof row.html === "string") return { html: row.html };
  if ("component" in row && typeof row.component === "string") {
    const out: Record<string, unknown> = { component: row.component };
    if (row.props !== undefined && row.props !== null) out.props = row.props;
    return out;
  }
  return zone;
}

/** Text for the JSON box. An empty value stays blank so the first paste has somewhere to land. */
export function jsonText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

/** Parse the JSON box. Blank stores null and keeps the zone. */
export function parseJsonText(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch (err) {
    throw new Error(err instanceof SyntaxError ? err.message : "Could not read this JSON.");
  }
}

/** Re-indent JSON the author has typed. Blank stays blank. */
export function formatJsonText(value: string): { ok: true; text: string } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, text: "" };
  try {
    return { ok: true, text: JSON.stringify(JSON.parse(trimmed) as unknown, null, 2) };
  } catch (err) {
    return { ok: false, error: err instanceof SyntaxError ? err.message : "Could not read this JSON." };
  }
}
