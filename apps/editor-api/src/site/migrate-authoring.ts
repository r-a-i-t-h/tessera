import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { compileWidgetsToHtml, widgetsFromLegacyHtml } from "@r-a-i-t-h/tessera-sections";
import {
  AUTHORING_SCHEMA_LEGACY_MAX,
  AUTHORING_SCHEMA_TARGET,
  LEGACY_SCALAR_HTML_ZONE_IDS,
} from "./authoring-constants.js";
import type { RecordKind } from "./kinds.js";
import { KIND_DIRS } from "./kinds.js";
import { isWidgetBlocks } from "./widget-schema.js";
import { readSchemaVersion, writeSchemaVersion, metaPath } from "../store/meta.js";
import { readText, writeTextAtomic } from "../store/fs.js";
import { recordToYaml, yamlToRecord } from "./document.js";

const COMPOSE_MIGRATE_KINDS: RecordKind[] = ["content", "templates"];

function isLegacyScalarHtmlZone(zoneId: string): boolean {
  return (LEGACY_SCALAR_HTML_ZONE_IDS as readonly string[]).includes(zoneId);
}

/** Migrate one authored zone from schema ≤3 to widget `blocks` lists. */
export function migrateAuthoredZone(zoneId: string, zone: unknown): unknown | undefined {
  if (!zone || typeof zone !== "object" || Array.isArray(zone)) return zone;
  const row = zone as Record<string, unknown>;

  if (isLegacyScalarHtmlZone(zoneId)) {
    if ("html" in row && typeof row.html === "string") return { html: row.html };
    return zone;
  }

  if ("blocks" in row && Array.isArray(row.blocks)) {
    if (isWidgetBlocks(row.blocks)) return zone;
    return zone;
  }

  if ("html" in row && typeof row.html === "string") {
    const widgets = widgetsFromLegacyHtml(row.html);
    return { blocks: widgets };
  }

  if ("json" in row) {
    return undefined;
  }

  if ("component" in row && typeof row.component === "string") {
    return zone;
  }

  return zone;
}

export function migrateAuthoredRecord(record: Record<string, unknown>): Record<string, unknown> {
  const zones = record.zones;
  if (!zones || typeof zones !== "object" || Array.isArray(zones)) return record;
  const next: Record<string, unknown> = {};
  for (const [zoneId, zone] of Object.entries(zones as Record<string, unknown>)) {
    const migrated = migrateAuthoredZone(zoneId, zone);
    if (migrated !== undefined) next[zoneId] = migrated;
  }
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

function migrateItemZone(zone: unknown): unknown | undefined {
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

/** Items stay html scalars (or component mounts), not compose widget blocks or json zones. */
export function migrateItemAuthoringRecord(record: Record<string, unknown>): Record<string, unknown> {
  const zones = record.zones;
  if (!zones || typeof zones !== "object" || Array.isArray(zones)) return record;
  const next: Record<string, unknown> = {};
  for (const [zoneId, zone] of Object.entries(zones as Record<string, unknown>)) {
    const migrated = migrateItemZone(zone);
    if (migrated !== undefined) next[zoneId] = migrated;
  }
  return { ...record, zones: next };
}

async function listYamlIds(recordsDir: string, kind: RecordKind): Promise<string[]> {
  const dir = join(recordsDir, KIND_DIRS[kind]);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return names.filter((name) => name.endsWith(".yaml") && name !== "_order.yaml").map((name) => name.slice(0, -5));
}

/**
 * When `meta.json` `schemaVersion` is below {@link AUTHORING_SCHEMA_TARGET}, rewrite zone YAML
 * (html → widget blocks, drop json zones) and bump the counter.
 */
export async function ensureAuthoringSchemaMigration(dataDir: string, recordsDir: string): Promise<boolean> {
  const meta = metaPath(dataDir);
  const current = await readSchemaVersion(meta);
  if (current >= AUTHORING_SCHEMA_TARGET) {
    await ensureItemAuthoringRepair(recordsDir);
    return false;
  }
  if (current > AUTHORING_SCHEMA_LEGACY_MAX) {
    throw new Error(`Unsupported authoring schemaVersion ${current}.`);
  }

  for (const kind of COMPOSE_MIGRATE_KINDS) {
    for (const id of await listYamlIds(recordsDir, kind)) {
      const file = join(recordsDir, KIND_DIRS[kind], `${id}.yaml`);
      const text = await readText(file);
      const raw = yamlToRecord(kind, text);
      const migrated = migrateAuthoredRecord(raw);
      if (JSON.stringify(migrated) !== JSON.stringify(raw)) {
        await writeTextAtomic(file, recordToYaml(kind, migrated));
      }
    }
  }

  await ensureItemAuthoringRepair(recordsDir);

  await writeSchemaVersion(meta, AUTHORING_SCHEMA_TARGET);
  return true;
}

/** Rewrite item zones on disk: widget blocks → html, drop json. */
export async function ensureItemAuthoringRepair(recordsDir: string): Promise<boolean> {
  let changed = false;
  for (const id of await listYamlIds(recordsDir, "items")) {
    const file = join(recordsDir, KIND_DIRS.items, `${id}.yaml`);
    const text = await readText(file);
    const raw = yamlToRecord("items", text);
    const repaired = migrateItemAuthoringRecord(raw);
    if (JSON.stringify(repaired) !== JSON.stringify(raw)) {
      await writeTextAtomic(file, recordToYaml("items", repaired));
      changed = true;
    }
  }
  return changed;
}
