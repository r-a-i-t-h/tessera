import type { SiteDocument } from "./schema.js";
import {
  fieldById,
  formatDatasetFieldDisplay,
  formatRecordDisplayName,
  rootColumnFieldIds,
  type DatasetField,
  type DatasetRootRecord,
  type DatasetSnapshot,
  type RecordDisplayContext,
} from "./dataset.js";

/** Flatten embeds validated dataset files; cast bridges Zod snapshot typing. */
export function documentDatasetMap(document: Pick<SiteDocument, "datasets">): Record<string, DatasetSnapshot> {
  return (document.datasets ?? {}) as Record<string, DatasetSnapshot>;
}

export type DatasetSortDir = "asc" | "desc";

export type DatasetFilterOp = "eq" | "neq" | "empty" | "notEmpty" | "gte" | "lte";

export type DatasetFilter = {
  field: string;
  op: DatasetFilterOp;
  value?: unknown;
};

export type DatasetQueryOptions = {
  dataset: string;
  fields?: readonly string[];
  sort?: { field: string; dir?: DatasetSortDir };
  limit?: number;
  filter?: readonly DatasetFilter[];
};

export type DatasetFieldCell = {
  id: string;
  label: string;
  text: string;
};

export type DatasetRowView = {
  uid: number;
  displayName: string;
  fields: DatasetFieldCell[];
};

export type DatasetQueryResult = {
  datasetId: string;
  datasetTitle: string;
  rows: DatasetRowView[];
};

export const DATASET_PRESENTATION_COMPONENTS = new Set([
  "datasetTable",
  "datasetCards",
  "datasetPlainList",
]);

/** Dataset ids named on bindings that use dataset presentation components. */
export function collectBindingDatasetIds(document: Pick<SiteDocument, "bindings">): string[] {
  const ids = new Set<string>();
  for (const binding of document.bindings ?? []) {
    if (!DATASET_PRESENTATION_COMPONENTS.has(binding.component)) continue;
    const raw = binding.props?.dataset;
    if (typeof raw === "string" && raw.trim()) ids.add(raw.trim());
  }
  return [...ids].sort();
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true });
}

function matchesFilter(record: DatasetRootRecord, filter: DatasetFilter): boolean {
  const raw = record[filter.field];
  const empty = raw === undefined || raw === null || raw === "";
  switch (filter.op) {
    case "empty":
      return empty;
    case "notEmpty":
      return !empty;
    case "eq":
      return !empty && raw === filter.value;
    case "neq":
      return empty || raw !== filter.value;
    case "gte":
      return !empty && compareValues(raw, filter.value) >= 0;
    case "lte":
      return !empty && compareValues(raw, filter.value) <= 0;
    default:
      return true;
  }
}

function sortKey(record: DatasetRootRecord, fieldId: string, fields: readonly DatasetField[]): unknown {
  if (fieldId === "uid") return record.uid;
  if (fieldId === "added") return record.added;
  if (fieldId === "modified") return record.modified;
  const field = fieldById(fields, fieldId);
  if (!field || field.kind === "object" || field.kind === "list") return "";
  return record[fieldId];
}

function resolveFieldList(snapshot: DatasetSnapshot, requested?: readonly string[]): DatasetField[] {
  const schemaFields = snapshot.schema.fields;
  const allowed = new Set(rootColumnFieldIds(schemaFields));
  allowed.add("uid");
  allowed.add("added");
  allowed.add("modified");
  const ids = requested?.length
    ? requested.filter((id) => allowed.has(id))
    : rootColumnFieldIds(schemaFields);
  const out: DatasetField[] = [];
  for (const id of ids) {
    if (id === "uid" || id === "added" || id === "modified") {
      out.push({
        key: id,
        id,
        label: id === "uid" ? "Uid" : id === "added" ? "Added" : "Modified",
        kind: id === "uid" ? "number" : "string",
      });
      continue;
    }
    const field = fieldById(schemaFields, id);
    if (field && field.kind !== "object" && field.kind !== "list") out.push(field);
  }
  return out;
}

function metaCell(record: DatasetRootRecord, id: string): string {
  if (id === "uid") return String(record.uid);
  if (id === "added") return record.added;
  if (id === "modified") return record.modified;
  return "";
}

export function queryDatasetRecords(
  snapshots: Readonly<Record<string, DatasetSnapshot>>,
  options: DatasetQueryOptions,
  ctx?: RecordDisplayContext,
): DatasetQueryResult | undefined {
  const snapshot = snapshots[options.dataset];
  if (!snapshot) return undefined;

  let rows: DatasetRootRecord[] = [...snapshot.records];
  const schemaFields = snapshot.schema.fields;

  for (const rule of options.filter ?? []) {
    rows = rows.filter((record) => matchesFilter(record, rule));
  }

  if (options.sort?.field) {
    const dir = options.sort.dir === "desc" ? -1 : 1;
    const fieldId = options.sort.field;
    rows.sort((a, b) => dir * compareValues(sortKey(a, fieldId, schemaFields), sortKey(b, fieldId, schemaFields)));
  }

  if (typeof options.limit === "number" && options.limit >= 0) {
    rows = rows.slice(0, options.limit);
  }

  const columns = resolveFieldList(snapshot, options.fields);
  const displayTemplate = snapshot.view.displayName ?? "";

  const viewRows: DatasetRowView[] = rows.map((record) => ({
    uid: record.uid,
    displayName: formatRecordDisplayName(record, displayTemplate, schemaFields, ctx),
    fields: columns.map((field) => {
      const text =
        field.id === "uid" || field.id === "added" || field.id === "modified"
          ? metaCell(record, field.id)
          : formatDatasetFieldDisplay(record, field, ctx);
      return { id: field.id, label: field.label, text };
    }),
  }));

  return {
    datasetId: snapshot.id,
    datasetTitle: snapshot.title,
    rows: viewRows,
  };
}

/** Walk ref fields in snapshots to include datasets referenced by embedded rows. */
export function expandDatasetIdsWithRefs(
  snapshots: Readonly<Record<string, DatasetSnapshot>>,
  seedIds: readonly string[],
): string[] {
  const pending = [...seedIds];
  const seen = new Set<string>();
  const out: string[] = [];
  while (pending.length) {
    const id = pending.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    const snapshot = snapshots[id];
    if (!snapshot) continue;
    for (const record of snapshot.records) {
      collectRefTargets(snapshot.schema.fields, record, pending, seen);
    }
  }
  return out.sort();
}

function collectRefTargets(
  fields: readonly DatasetField[],
  obj: Record<string, unknown>,
  pending: string[],
  seen: Set<string>,
): void {
  for (const field of fields) {
    if (field.kind === "ref" && field.dataset && obj[field.id] !== undefined && obj[field.id] !== null) {
      if (!seen.has(field.dataset)) pending.push(field.dataset);
    }
    if (field.kind === "object" && field.fields?.length) {
      const nested = obj[field.id];
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        collectRefTargets(field.fields, nested as Record<string, unknown>, pending, seen);
      }
    }
    if (field.kind === "list" && Array.isArray(obj[field.id])) {
      for (const item of obj[field.id] as unknown[]) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          collectRefTargets(field.fields ?? [], item as Record<string, unknown>, pending, seen);
        }
      }
    }
  }
}
