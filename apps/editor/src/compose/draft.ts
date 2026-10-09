import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export function parsePageYaml(
  raw: string,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  try {
    const data = parseYaml(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, error: "This page file must be a YAML mapping." };
    }
    return { ok: true, data: data as Record<string, unknown> };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not read that YAML." };
  }
}

export function draftYaml(data: unknown): string {
  return `${stringifyYaml(data, { indent: 2, lineWidth: 0 }).trimEnd()}\n`;
}

export function withZoneHtml(
  record: Record<string, unknown>,
  zoneHtml: Record<string, string>,
): Record<string, unknown> {
  const current =
    record.zones && typeof record.zones === "object" && !Array.isArray(record.zones)
      ? { ...(record.zones as Record<string, unknown>) }
      : {};
  for (const [name, html] of Object.entries(zoneHtml)) {
    const existing = current[name];
    if (isDataZone(existing)) continue;
    current[name] = { html };
  }
  return { ...record, zones: current };
}

/** An article title is the record title. A copied title zone is not on the article layout. */
export function dropArticleTitleZone(record: Record<string, unknown>): Record<string, unknown> {
  if (record.type !== "article") return record;
  const zones = record.zones;
  if (!zones || typeof zones !== "object" || Array.isArray(zones) || !("title" in zones)) return record;
  const title = (zones as Record<string, unknown>).title;
  if (isDataZone(title)) return record;
  const next = { ...(zones as Record<string, unknown>) };
  delete next.title;
  return { ...record, zones: next };
}

function isDataZone(zone: unknown): boolean {
  if (!zone || typeof zone !== "object" || Array.isArray(zone)) return false;
  return "json" in zone || "blocks" in zone || "component" in zone;
}
