import {
  documentDatasetMap,
  fieldById,
  formatDatasetFieldDisplay,
  formatDatasetFieldRichHtml,
  type DatasetField,
  type DatasetRootRecord,
  type DatasetSnapshot,
  type RecordDisplayContext,
  walkDatasetRecords,
} from "@r-a-i-t-h/tessera-model";

export type DatasetDrillSection = {
  fieldId: string;
  label: string;
  kind: "object" | "ref";
  columns: { id: string; label: string }[];
  rows: { cells: Record<string, string>; richCells?: Record<string, string> }[];
};

export type DatasetDrillDownPayload = {
  title: string;
  topLevel: { id: string; label: string; text: string; richHtml?: string }[];
  sections: DatasetDrillSection[];
};

function recordHasDrillContent(fields: readonly DatasetField[], record: Record<string, unknown>): boolean {
  for (const field of fields) {
    if (field.kind === "object" || field.kind === "ref") {
      const v = record[field.id];
      if (v === undefined || v === null || v === "") continue;
      if (field.many && Array.isArray(v) && !v.length) continue;
      return true;
    }
  }
  return false;
}

function topLevelDetail(
  record: DatasetRootRecord,
  fields: readonly DatasetField[],
  ctx: RecordDisplayContext,
): DatasetDrillDownPayload["topLevel"] {
  return fields
    .filter((f) => f.kind !== "object" && f.kind !== "ref")
    .map((field) => {
      const richHtml = formatDatasetFieldRichHtml(record, field, ctx);
      return {
        id: field.id,
        label: field.label,
        text: formatDatasetFieldDisplay(record, field, ctx),
        ...(richHtml ? { richHtml } : {}),
      };
    });
}

function objectSection(
  field: DatasetField,
  record: Record<string, unknown>,
  ctx: RecordDisplayContext,
): DatasetDrillSection | undefined {
  const raw = record[field.id];
  const subfields = field.fields ?? [];
  if (!subfields.length) return undefined;
  const columns = subfields.map((f) => ({ id: f.id, label: f.label }));
  const rows: DatasetDrillSection["rows"] = [];
  const items = field.many ? (Array.isArray(raw) ? raw : []) : raw && typeof raw === "object" ? [raw] : [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const obj = item as Record<string, unknown>;
    const cells: Record<string, string> = {};
    const richCells: Record<string, string> = {};
    for (const sub of subfields) {
      const pseudo = { ...obj };
      cells[sub.id] = formatDatasetFieldDisplay(pseudo, sub, ctx);
      const rich = formatDatasetFieldRichHtml(pseudo, sub, ctx);
      if (rich) richCells[sub.id] = rich;
    }
    rows.push({ cells, ...(Object.keys(richCells).length ? { richCells } : {}) });
  }
  if (!rows.length) return undefined;
  return { fieldId: field.id, label: field.label, kind: "object", columns, rows };
}

function refSection(
  field: DatasetField,
  record: Record<string, unknown>,
  snapshots: Record<string, DatasetSnapshot>,
  ctx: RecordDisplayContext,
): DatasetDrillSection | undefined {
  const raw = record[field.id];
  const targetId = field.dataset ?? "";
  const snap = snapshots[targetId];
  if (!snap) return undefined;
  const uids = field.many ? refUids(raw) : refUids(raw).slice(0, 1);
  if (!uids.length) return undefined;
  const columns = snap.schema.fields
    .filter((f) => f.kind !== "object")
    .slice(0, 8)
    .map((f) => ({ id: f.id, label: f.label }));
  const rows: DatasetDrillSection["rows"] = [];
  for (const uid of uids) {
    const target = snap.records.find((r) => r.uid === uid);
    if (!target) {
      rows.push({ cells: { uid: String(uid) } });
      continue;
    }
    const cells: Record<string, string> = { uid: String(uid) };
    const richCells: Record<string, string> = {};
    for (const col of columns) {
      const f = fieldById(snap.schema.fields, col.id);
      if (!f || f.kind === "object") continue;
      cells[col.id] = formatDatasetFieldDisplay(target, f, ctx);
      const rich = formatDatasetFieldRichHtml(target, f, ctx);
      if (rich) richCells[col.id] = rich;
    }
    rows.push({ cells, ...(Object.keys(richCells).length ? { richCells } : {}) });
  }
  return { fieldId: field.id, label: field.label, kind: "ref", columns, rows };
}

function refUids(raw: unknown): number[] {
  if (raw === undefined || raw === null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((v): v is number => typeof v === "number" && Number.isInteger(v) && v > 0);
  }
  return typeof raw === "number" && Number.isInteger(raw) && raw > 0 ? [raw] : [];
}

export function buildDrillDownPayload(
  snapshot: DatasetSnapshot,
  record: DatasetRootRecord,
  snapshots: Record<string, DatasetSnapshot>,
  ctx: RecordDisplayContext,
): DatasetDrillDownPayload | undefined {
  if (!recordHasDrillContent(snapshot.schema.fields, record)) return undefined;
  const sections: DatasetDrillSection[] = [];
  for (const field of snapshot.schema.fields) {
    if (field.kind === "object") {
      const section = objectSection(field, record, ctx);
      if (section) sections.push(section);
    }
    if (field.kind === "ref") {
      const section = refSection(field, record, snapshots, ctx);
      if (section) sections.push(section);
    }
  }
  return {
    title: `Record #${record.uid}`,
    topLevel: topLevelDetail(record, snapshot.schema.fields, ctx),
    sections,
  };
}

export function buildWalkedRawPayload(
  snapshots: Record<string, DatasetSnapshot>,
  datasetId: string,
  roots: readonly DatasetRootRecord[],
): { datasetId: string; records: Record<string, DatasetRootRecord> } {
  const { records: walked } = walkDatasetRecords(
    snapshots,
    roots.map((record) => ({ datasetId, record })),
  );
  const out: Record<string, DatasetRootRecord> = {};
  for (const [key, row] of walked) out[key] = row;
  return { datasetId, records: out };
}

export function snapshotsFromDocument(document: { datasets?: unknown }): Record<string, DatasetSnapshot> {
  return documentDatasetMap(document as Parameters<typeof documentDatasetMap>[0]);
}
