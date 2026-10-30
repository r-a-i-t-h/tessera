/**
 * Authoring schema decisions (Phase 0). See packages/sections `widget.ts` and site migration.
 */

/** Last schema before compose zones were blocks-only (no zone html/component on pages). */
export const AUTHORING_SCHEMA_LEGACY_MAX = 4 as const;

/**
 * Target `meta.json` `schemaVersion` after blocks-only page zones.
 * When `readSchemaVersion(meta) < AUTHORING_SCHEMA_TARGET`, post-update migration runs on
 * editor API boot (and via `npm run migrate:authoring` for an offline pass).
 */
export const AUTHORING_SCHEMA_TARGET = 5 as const;

/**
 * Persisted shape for compose-backed zones (main, title, lead, frame zones, …):
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

/** Insert widget compile rule: persisted `{ kind: insert, id }` → `{{id}}` in compiled zone HTML at assemble (see `compileWidgetsToHtml`). */
export const INSERT_WIDGET_COMPILE = "mustache-in-text-html" as const;
