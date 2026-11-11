import {
  documentDatasetMap,
  fieldById,
  type DatasetFieldKind,
  queryDatasetRecords,
  type DatasetQueryOptions,
  type DatasetRowView,
  type DatasetSnapshot,
  type RecordDisplayContext,
} from "@r-a-i-t-h/tessera-model";
import { resolvePageRefs, type RenderContext } from "@r-a-i-t-h/tessera-renderer";
import type { DatasetDrillDownPayload } from "./dataset-drilldown.js";
import { normalizeFrameColor } from "@r-a-i-t-h/tessera-sections";
import { buildDrillDownPayload } from "./dataset-drilldown.js";
import { queryOptionsFromProps } from "./dataset-present-props.js";

export type DatasetColumnAlign = "left" | "center" | "right";

export type DatasetColumnCellFormat = "url" | "asset" | "html";

export type DatasetColumnPayload = {
  id: string;
  label: string;
  sortable: boolean;
  align: DatasetColumnAlign;
  /** How to paint the cell when `richValues` is absent (url icon link, etc.). */
  cellFormat?: DatasetColumnCellFormat;
};

export type DatasetRowPayload = {
  uid: number;
  displayName: string;
  values: Record<string, string>;
  /** Sanitized HTML for asset columns. */
  richValues?: Record<string, string>;
  hasDrillDown?: boolean;
  drillDown?: import("./dataset-drilldown.js").DatasetDrillDownPayload;
};

export type DatasetViewPayload = {
  variant: "table" | "cards" | "list";
  empty: string;
  showHeader: boolean;
  headingField?: string;
  compact?: boolean;
  sort: { field: string; dir: "asc" | "desc" };
  /** When true, visitors can change sort in the browser (rows are re-ordered client-side). */
  interactiveSort: boolean;
  columns: DatasetColumnPayload[];
  rows: DatasetRowPayload[];
  /** Framed cards only: CSS colour for `--tessera-frame-bg`. */
  frameColor?: string;
};

function columnCellFormat(kind?: DatasetFieldKind): DatasetColumnCellFormat | undefined {
  if (kind === "url" || kind === "asset" || kind === "html" || kind === "text") return kind === "text" ? "html" : kind;
  return undefined;
}

export function datasetColumnAlign(fieldId: string, snapshot: DatasetSnapshot): DatasetColumnAlign {
  if (fieldId === "uid") return "right";
  if (fieldId === "added" || fieldId === "modified") return "center";
  const field = fieldById(snapshot.schema.fields, fieldId);
  if (!field) return "left";
  if (field.kind === "number" || field.kind === "boolean") return "right";
  if (field.kind === "date") return "center";
  return "left";
}

function isSortableColumn(fieldId: string, snapshot: DatasetSnapshot): boolean {
  if (fieldId === "uid" || fieldId === "added" || fieldId === "modified") return true;
  const field = fieldById(snapshot.schema.fields, fieldId);
  if (!field) return false;
  if (field.kind === "asset" || field.kind === "object" || field.kind === "ref") {
    return false;
  }
  return true;
}

function resolveDatasetRichHtml(html: string, ctx: RenderContext): string {
  return resolvePageRefs(html, ctx);
}

function resolveDrillDownPayload(drill: DatasetDrillDownPayload, ctx: RenderContext): DatasetDrillDownPayload {
  return {
    ...drill,
    topLevel: drill.topLevel.map((field) => ({
      ...field,
      ...(field.richHtml ? { richHtml: resolveDatasetRichHtml(field.richHtml, ctx) } : {}),
    })),
    sections: drill.sections.map((section) => ({
      ...section,
      rows: section.rows.map((row) => {
        if (!row.richCells) return row;
        const richCells: Record<string, string> = {};
        for (const [id, html] of Object.entries(row.richCells)) {
          richCells[id] = resolveDatasetRichHtml(html, ctx);
        }
        return { ...row, richCells };
      }),
    })),
  };
}

function resolveRowPayload(row: DatasetRowPayload, ctx: RenderContext): DatasetRowPayload {
  if (!row.richValues) return row;
  const richValues: Record<string, string> = {};
  for (const [id, html] of Object.entries(row.richValues)) {
    richValues[id] = resolveDatasetRichHtml(html, ctx);
  }
  const out: DatasetRowPayload = { ...row, richValues };
  if (row.drillDown) out.drillDown = resolveDrillDownPayload(row.drillDown, ctx);
  return out;
}

function rowToPayload(row: DatasetRowView): DatasetRowPayload {
  const values: Record<string, string> = {};
  const richValues: Record<string, string> = {};
  for (const cell of row.fields) {
    values[cell.id] = cell.text;
    if (cell.richHtml) richValues[cell.id] = cell.richHtml;
  }
  return {
    uid: row.uid,
    displayName: row.displayName,
    values,
    ...(Object.keys(richValues).length ? { richValues } : {}),
  };
}

function resolveSort(
  props: Record<string, unknown>,
  columns: DatasetColumnPayload[],
): { field: string; dir: "asc" | "desc" } {
  const sortRaw = props.sort;
  if (sortRaw && typeof sortRaw === "object" && !Array.isArray(sortRaw)) {
    const field = typeof (sortRaw as { field?: unknown }).field === "string" ? (sortRaw as { field: string }).field : "";
    const dir = (sortRaw as { dir?: unknown }).dir === "desc" ? "desc" : "asc";
    if (field && columns.some((c) => c.id === field)) return { field, dir };
  }
  const first = columns.find((c) => c.sortable) ?? columns[0];
  return { field: first?.id ?? "uid", dir: "asc" };
}

export function buildDatasetViewPayload(
  ctx: RenderContext,
  props: Record<string, unknown>,
  variant: DatasetViewPayload["variant"],
  display: RecordDisplayContext,
): DatasetViewPayload | undefined {
  const options = queryOptionsFromProps(props, ctx.page.id);
  if (!options) return undefined;
  const snapshots = documentDatasetMap(ctx.document);
  const snapshot = snapshots[options.dataset];
  if (!snapshot) return undefined;

  const queryOpts: DatasetQueryOptions = { ...options };
  if (!queryOpts.sort) delete queryOpts.sort;

  const result = queryDatasetRecords(snapshots, queryOpts, display);
  if (!result) return undefined;

  const columns: DatasetColumnPayload[] = (result.rows[0]?.fields ?? []).map((f) => {
    const field = fieldById(snapshot.schema.fields, f.id);
    const cellFormat = columnCellFormat(field?.kind);
    return {
      id: f.id,
      label: f.label,
      sortable: isSortableColumn(f.id, snapshot),
      align: datasetColumnAlign(f.id, snapshot),
      ...(cellFormat ? { cellFormat } : {}),
    };
  });

  const headingProp =
    typeof props.headingField === "string" && props.headingField.trim() ? props.headingField.trim() : undefined;
  const headingField =
    variant === "cards" ? resolveCardHeadingField(columns, headingProp) : headingProp;

  const frameColorRaw = typeof props.frameColor === "string" ? props.frameColor : "";
  const frameColor =
    variant === "cards" ? normalizeFrameColor(frameColorRaw) : undefined;

  const schemaRecordByUid = new Map(result.rows.map((r) => [r.uid, snapshot.records.find((rec) => rec.uid === r.uid)]));
  return {
    variant,
    empty: typeof props.empty === "string" ? props.empty : "",
    showHeader: props.showHeader !== false,
    headingField,
    compact: props.compact === true,
    sort: resolveSort(props, columns),
    interactiveSort: props.interactiveSort === true,
    columns,
    rows: result.rows.map((row) => {
      let payload = rowToPayload(row);
      const record = schemaRecordByUid.get(row.uid);
      if (record) {
        const drillDown = buildDrillDownPayload(snapshot, record, snapshots, display);
        if (drillDown) payload = { ...payload, hasDrillDown: true, drillDown };
      }
      return resolveRowPayload(payload, ctx);
    }),
    ...(frameColor ? { frameColor } : {}),
  };
}

/** Card title column: explicit field or the first visible column. */
export function resolveCardHeadingField(
  columns: readonly DatasetColumnPayload[],
  headingField?: string,
): string | undefined {
  if (headingField && columns.some((col) => col.id === headingField)) return headingField;
  return columns[0]?.id;
}

/** Title / list line when displayName is only the empty-template uid fallback. */
export function datasetRowTitle(
  row: DatasetRowPayload,
  payload: Pick<DatasetViewPayload, "headingField" | "columns">,
): string {
  if (payload.headingField) {
    const heading = row.values[payload.headingField]?.trim();
    if (heading) return heading;
  }
  const display = row.displayName.trim();
  const uidFallback = `#${row.uid}`;
  if (display && display !== uidFallback) return display;
  const parts = payload.columns.map((col) => row.values[col.id]?.trim()).filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return display || uidFallback;
}

export function sortRowsClient(
  rows: DatasetRowPayload[],
  field: string,
  dir: "asc" | "desc",
): DatasetRowPayload[] {
  const sign = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = field === "displayName" ? a.displayName : (a.values[field] ?? "");
    const bv = field === "displayName" ? b.displayName : (b.values[field] ?? "");
    return sign * av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
  });
}

export function escapeJsonScript(json: string): string {
  return json.replace(/<\/script/gi, "<\\/script");
}
