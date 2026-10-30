import { widgetsFromLegacyHtml } from "@r-a-i-t-h/tessera-sections";

/** Valid content/template zone shape after schema 5 (blocks-only). */
export function zoneBlocks(html = "") {
  return { blocks: widgetsFromLegacyHtml(html) };
}

export function contentZones(mainHtml: string, extra?: Record<string, string>) {
  const zones: Record<string, ReturnType<typeof zoneBlocks>> = {
    main: zoneBlocks(mainHtml),
  };
  if (extra) {
    for (const [id, html] of Object.entries(extra)) {
      zones[id] = zoneBlocks(html);
    }
  }
  return zones;
}
