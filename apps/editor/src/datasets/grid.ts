import type { DatasetField, DatasetRootRecord } from "@r-a-i-t-h/tessera-model";
import { fieldById, rootColumnFieldIds } from "@r-a-i-t-h/tessera-model";

export type GridColumn =
  | { kind: "system"; id: "uid" | "added" | "modified" }
  | { kind: "field"; id: string; field: DatasetField };

export type GridSort = { column: string; dir: "asc" | "desc" };

export type GridFilters = Record<string, string>;

const VIEW_META_COLUMNS = new Set(["uid", "added", "modified"]);

export function gridColumns(viewColumns: readonly string[], fields: readonly DatasetField[]): GridColumn[] {
  const cols: GridColumn[] = [];
  for (const id of viewColumns) {
    if (VIEW_META_COLUMNS.has(id)) {
      cols.push({ kind: "system", id: id as "uid" | "added" | "modified" });
      continue;
    }
    const field = fieldById(fields, id);
    if (field) {
      cols.push({ kind: "field", id, field });
    }
  }
  return cols;
}

export type DisplayContext = {
  assetName: (id: string) => string;
  refTitle: (datasetId: string, uid: number) => string;
  assetMarkup?: (id: string) => string | undefined;
};

/** Sanitized HTML for asset cells in the data grid (view mode). */
export function cellDisplayMarkup(
  record: DatasetRootRecord,
  column: GridColumn,
  ctx: DisplayContext,
): string | undefined {
  if (column.kind !== "field") return undefined;
  const field = column.field;
  const raw = record[field.id];
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (field.kind === "asset" && !field.many) {
    return ctx.assetMarkup?.(String(raw));
  }
  return undefined;
}

export function cellDisplay(
  record: DatasetRootRecord,
  column: GridColumn,
  ctx: DisplayContext,
): string {
  if (column.kind === "system") {
    const v = record[column.id];
    if (column.id === "added" || column.id === "modified") {
      return typeof v === "string" ? formatLocalDateTime(v) : "";
    }
    return v === undefined || v === null ? "" : String(v);
  }
  const field = column.field;
  const raw = record[field.id];
  if (raw === undefined || raw === null) return "";
  switch (field.kind) {
    case "boolean":
      return raw === true ? "Yes" : "No";
    case "asset":
      if (field.many && Array.isArray(raw)) {
        return raw.map((id) => ctx.assetName(String(id))).join(", ");
      }
      return ctx.assetName(String(raw));
    case "ref":
      return ctx.refTitle(field.dataset ?? "", Number(raw));
    case "text":
      return String(raw).replace(/\s+/g, " ").trim();
    default:
      return String(raw);
  }
}

function formatLocalDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function compareValues(a: string, b: string, dir: "asc" | "desc"): number {
  const cmp = a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
  return dir === "asc" ? cmp : -cmp;
}

export function sortRecords(
  records: readonly DatasetRootRecord[],
  columns: readonly GridColumn[],
  sort: GridSort | undefined,
  ctx: DisplayContext,
): DatasetRootRecord[] {
  if (!sort) return [...records];
  const col = columns.find((c) => (c.kind === "system" ? c.id : c.id) === sort.column);
  if (!col) return [...records];
  return [...records].sort((a, b) => {
    if (col.kind === "system" && col.id === "uid") {
      const cmp = a.uid - b.uid;
      return sort.dir === "asc" ? cmp : -cmp;
    }
    return compareValues(cellDisplay(a, col, ctx), cellDisplay(b, col, ctx), sort.dir);
  });
}

export function filterRecords(
  records: readonly DatasetRootRecord[],
  columns: readonly GridColumn[],
  filters: GridFilters,
  ctx: DisplayContext,
): DatasetRootRecord[] {
  return records.filter((record) => {
    for (const column of columns) {
      const key = column.kind === "system" ? column.id : column.id;
      const filter = filters[key]?.trim();
      if (!filter) continue;
      const text = cellDisplay(record, column, ctx);
      if (column.kind === "system" && column.id === "uid") {
        const minMax = filter.split("..").map((p) => p.trim());
        const n = record.uid;
        if (minMax[0] && Number(minMax[0]) > n) return false;
        if (minMax[1] && Number(minMax[1]) < n) return false;
        continue;
      }
      if (column.kind === "field" && column.field.kind === "boolean") {
        if (filter === "yes" && record[column.field.id] !== true) return false;
        if (filter === "no" && record[column.field.id] !== false) return false;
        continue;
      }
      if (column.kind === "field" && (column.field.kind === "number" || column.field.kind === "ref")) {
        const minMax = filter.split("..").map((p) => p.trim());
        const n = Number(record[column.field.id]);
        if (minMax[0] && Number(minMax[0]) > n) return false;
        if (minMax[1] && Number(minMax[1]) < n) return false;
        continue;
      }
      if (!text.toLowerCase().includes(filter.toLowerCase())) return false;
    }
    return true;
  });
}

export function availableViewColumns(fields: readonly DatasetField[]): string[] {
  return ["uid", ...rootColumnFieldIds(fields), "added", "modified"];
}
