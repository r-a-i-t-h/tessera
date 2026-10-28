import { paintSections, parseSections, type PanelToneDef, type Section } from "./sections.js";

/**
 * Ordered composable on the widget surface (Compose / Frame zones).
 * Same JSON shape as {@link Section}; persisted under `zones.<id>.blocks` with a `kind` field.
 *
 * These are **not** renderer `Block` rows (`type: text`, etc.). Assemble compiles widgets → HTML → blocks.
 */
export type Widget = Section;

/** Compose-backed zone payload in page/article YAML. */
export type AuthoredComposeZone = {
  blocks: Widget[];
};

/**
 * Compile widgets to zone HTML for assemble/publish.
 * Standalone `{ kind: "insert", id }` widgets become `{{id}}` via {@link paintSections}.
 */
export function compileWidgetsToHtml(widgets: readonly Widget[], tones?: readonly PanelToneDef[]): string {
  return paintSections([...widgets], tones);
}

/** Migration helper: legacy `zones.<id>.html` → widget list. */
export function widgetsFromLegacyHtml(html: string, tones?: readonly PanelToneDef[]): Widget[] {
  return parseSections(html, tones);
}
