import type { DatasetField, DatasetRootRecord, DatasetSnapshot } from "./dataset.js";

export type DatasetRecordRef = { datasetId: string; uid: number };

function refUidsFromValue(value: unknown, many: boolean | undefined): number[] {
  if (value === undefined || value === null) return [];
  if (many) {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is number => typeof v === "number" && Number.isInteger(v) && v > 0);
  }
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? [value] : [];
}

function collectRefsInObject(
  fields: readonly DatasetField[],
  obj: Record<string, unknown>,
  addTarget: (datasetId: string, uid: number) => void,
): void {
  for (const field of fields) {
    const raw = obj[field.id];
    if (field.kind === "ref" && field.dataset) {
      for (const uid of refUidsFromValue(raw, field.many)) addTarget(field.dataset, uid);
      continue;
    }
    if (field.kind === "object" && field.fields?.length) {
      const rows = field.many ? (Array.isArray(raw) ? raw : []) : raw && typeof raw === "object" ? [raw] : [];
      for (const row of rows) {
        if (row && typeof row === "object") {
          collectRefsInObject(field.fields, row as Record<string, unknown>, addTarget);
        }
      }
    }
  }
}

/** Follow stored ref fields from roots; each record at most once. */
export function walkDatasetRecords(
  snapshots: Readonly<Record<string, DatasetSnapshot>>,
  roots: readonly { datasetId: string; record: DatasetRootRecord }[],
): { records: Map<string, DatasetRootRecord>; order: DatasetRecordRef[] } {
  const records = new Map<string, DatasetRootRecord>();
  const order: DatasetRecordRef[] = [];
  const pending: DatasetRecordRef[] = roots.map((r) => ({ datasetId: r.datasetId, uid: r.record.uid }));

  const enqueue = (ref: DatasetRecordRef) => {
    const key = `${ref.datasetId}:${ref.uid}`;
    if (records.has(key)) return;
    const snap = snapshots[ref.datasetId];
    const row = snap?.records.find((r) => r.uid === ref.uid);
    if (!row) return;
    records.set(key, row);
    order.push(ref);
    collectRefsInObject(snap.schema.fields, row, (datasetId, uid) => {
      pending.push({ datasetId, uid });
    });
  };

  while (pending.length) {
    const ref = pending.shift()!;
    enqueue(ref);
  }

  return { records, order };
}

export function pageDataRoots(
  snapshots: Readonly<Record<string, DatasetSnapshot>>,
  datasetId: string,
  pageId: string,
): DatasetRootRecord[] {
  const snap = snapshots[datasetId];
  if (!snap) return [];
  return snap.records.filter((r) => typeof r.page === "string" && r.page === pageId);
}

export function sourceDatasetRoots(
  snapshots: Readonly<Record<string, DatasetSnapshot>>,
  datasetId: string,
): DatasetRootRecord[] {
  const snap = snapshots[datasetId];
  if (!snap) return [];
  return [...snap.records];
}
