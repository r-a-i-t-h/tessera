/** A zone id safe to use as a form path (`zones.<id>.html` splits on dots). */
const ZONE_ID = /^[A-Za-z][A-Za-z0-9_-]*$/;

export type ItemContent = "html" | "json";

export type NewItemBody = {
  id: string;
  zones: Record<string, { html: string } | { json: null }>;
};

export function itemZoneError(zone: string): string | undefined {
  const name = zone.trim();
  if (!name) return "Enter a zone.";
  if (!ZONE_ID.test(name)) {
    return "Zone must start with a letter, then only letters, numbers, hyphens, or underscores.";
  }
  return undefined;
}

/** A shared item that fills one layout zone with HTML or an empty JSON value. */
export function newItemBody(id: string, zone: string, content: ItemContent = "html"): NewItemBody {
  const name = zone.trim();
  return {
    id: id.trim(),
    zones: { [name]: content === "json" ? { json: null } : { html: "" } },
  };
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
