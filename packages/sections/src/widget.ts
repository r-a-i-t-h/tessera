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

function filterHidden(widgets: readonly Widget[]): Widget[] {
  return widgets
    .filter((widget) => widget.hidden !== true)
    .map((widget) => {
      if (widget.kind === "panel" || widget.kind === "card") {
        return { ...widget, sections: filterHidden(widget.sections) };
      }
      if (widget.kind === "columns") {
        return {
          ...widget,
          cells: widget.cells.map((cell) => ({
            ...cell,
            sections: filterHidden(cell.sections),
          })),
        };
      }
      return widget;
    });
}

/**
 * Compile widgets to zone HTML for assemble/publish.
 * Standalone `{ kind: "insert", id }` widgets become `{{id}}` via {@link paintSections}.
 * Widgets with `hidden: true` are omitted (including nested children when a parent is hidden).
 */
export function compileWidgetsToHtml(widgets: readonly Widget[], tones?: readonly PanelToneDef[]): string {
  return paintSections(filterHidden(widgets), tones);
}

/** Migration helper: legacy `zones.<id>.html` → widget list. */
export function widgetsFromLegacyHtml(html: string, tones?: readonly PanelToneDef[]): Widget[] {
  return parseSections(html, tones);
}
