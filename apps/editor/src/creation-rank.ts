import type { RecordSummary } from "./api.js";

/** Index in `listRecords()` content order (oldest = 0, newest = highest). */
export function buildContentCreationRank(records: readonly RecordSummary[]): Map<string, number> {
  const rank = new Map<string, number>();
  let index = 0;
  for (const row of records) {
    if (row.kind !== "content") continue;
    rank.set(row.id, index);
    index += 1;
  }
  return rank;
}

export function compareCreationNewestFirst(
  a: RecordSummary,
  b: RecordSummary,
  rank: ReadonlyMap<string, number>,
): number {
  const ra = rank.get(a.id) ?? -1;
  const rb = rank.get(b.id) ?? -1;
  if (ra !== rb) return rb - ra;
  return a.id.localeCompare(b.id);
}

export function compareAlpha(a: RecordSummary, b: RecordSummary): number {
  const ta = (a.title ?? a.id).localeCompare(b.title ?? b.id, undefined, { sensitivity: "base" });
  return ta !== 0 ? ta : a.id.localeCompare(b.id);
}
