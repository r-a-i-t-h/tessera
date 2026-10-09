/** A zone id safe to use as a form path (`zones.<id>.html` splits on dots). */
const ZONE_ID = /^[A-Za-z][A-Za-z0-9_-]*$/;

export type ItemContent = "html" | "json" | "component" | "blocks";

export type ItemZone =
  | { html: string }
  | { json: null }
  | { component: string }
  | { blocks: unknown[] };

export type NewItemBody = {
  id: string;
  zones: Record<string, ItemZone>;
};

export function itemZoneError(zone: string): string | undefined {
  const name = zone.trim();
  if (!name) return "Enter a zone.";
  if (!ZONE_ID.test(name)) {
    return "Zone must start with a letter, then only letters, numbers, hyphens, or underscores.";
  }
  return undefined;
}

export function itemContent(value: string): ItemContent {
  if (value === "json" || value === "component" || value === "blocks") return value;
  return "html";
}

/** A shared item that fills one layout zone. JSON starts empty. Blocks start as an empty array. */
export function newItemBody(id: string, zone: string, content: ItemContent = "html", componentName = ""): NewItemBody {
  const name = zone.trim();
  return {
    id: id.trim(),
    zones: { [name]: zoneFor(content, componentName) },
  };
}

function zoneFor(content: ItemContent, componentName: string): ItemZone {
  if (content === "json") return { json: null };
  if (content === "blocks") return { blocks: [] };
  if (content === "component") return { component: componentName.trim() };
  return { html: "" };
}

/**
 * Blank component props are omitted. A blank block list stays an empty array.
 * Both keep the zone in the shape the editor opened.
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
  if ("blocks" in row && row.blocks === null) row.blocks = [];
  return row;
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
