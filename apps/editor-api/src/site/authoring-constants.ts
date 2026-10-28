/**
 * Authoring schema decisions (Phase 0). See packages/sections `widget.ts` and site migration.
 */

/** Last schema before compose zones persisted as widget `blocks` lists (html/json/component shorthands). */
export const AUTHORING_SCHEMA_LEGACY_MAX = 3 as const;

/**
 * Target `meta.json` `schemaVersion` after widget migration completes.
 * Run migration when `readSchemaVersion(meta) < AUTHORING_SCHEMA_TARGET`.
 */
export const AUTHORING_SCHEMA_TARGET = 4 as const;

/**
 * Persisted shape for compose-backed zones (main, lead, minutes, frame html zones, …):
 *
 * ```yaml
 * zones:
 *   main:
 *     blocks:
 *       - kind: text
 *         heading: ""
 *         level: 2
 *         html: "<p>Body</p>"
 *       - kind: insert
 *         id: hall-gallery
 * ```
 *
 * - Empty compose zone: `blocks: []` (explicit list, not omitted).
 * - Widget objects use `kind`, not renderer `Block`'s `type`.
 * - Nested palette containers (panel, card, columns) keep nested arrays as `sections` on the widget JSON (same as today’s Section tree).
 */
export const COMPOSE_ZONE_BLOCKS_KEY = "blocks" as const;

/**
 * Zones that stay **`html:` plain string** on the Page tab (not widget canvas), until unified later:
 * - `title` on blog/listing pages (layout title outlet; often plain text matching record title).
 * - Articles: body on widget surface (`main`); page title is record `title` + hero, not a title zone on canvas.
 */
export const LEGACY_SCALAR_HTML_ZONE_IDS = ["title"] as const;

/** Insert widget compile rule: persisted `{ kind: insert, id }` → `{{id}}` in compiled zone HTML at assemble (see `compileWidgetsToHtml`). */
export const INSERT_WIDGET_COMPILE = "mustache-in-text-html" as const;
