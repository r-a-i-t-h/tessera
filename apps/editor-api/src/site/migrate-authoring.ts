import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { widgetsFromLegacyHtml } from "@r-a-i-t-h/tessera-sections";
import {
  AUTHORING_SCHEMA_LEGACY_MAX,
  AUTHORING_SCHEMA_TARGET,
  LEGACY_SCALAR_HTML_ZONE_IDS,
} from "./authoring-constants.js";
import type { RecordKind } from "./kinds.js";
import { KIND_DIRS, RECORD_KINDS } from "./kinds.js";
import { isWidgetBlocks } from "./widget-schema.js";
import { readSchemaVersion, writeSchemaVersion, metaPath } from "../store/meta.js";
import { readText, writeTextAtomic } from "../store/fs.js";
import { recordToYaml, yamlToRecord } from "./document.js";

const ZONE_KINDS: RecordKind[] = ["content", "templates", "items"];

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
  if (current >= AUTHORING_SCHEMA_TARGET) return false;
  if (current > AUTHORING_SCHEMA_LEGACY_MAX) {
    throw new Error(`Unsupported authoring schemaVersion ${current}.`);
  }

  for (const kind of ZONE_KINDS) {
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

  await writeSchemaVersion(meta, AUTHORING_SCHEMA_TARGET);
  return true;
}
