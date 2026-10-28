/** Keep in sync with apps/editor-api/src/site/authoring-constants.ts */
export const LEGACY_SCALAR_HTML_ZONE_IDS = ["title"] as const;

export function isLegacyScalarHtmlZone(zoneId: string): boolean {
  return (LEGACY_SCALAR_HTML_ZONE_IDS as readonly string[]).includes(zoneId);
}
