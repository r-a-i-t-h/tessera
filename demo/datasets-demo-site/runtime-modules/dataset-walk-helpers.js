/**
 * Helpers for Tessera runtime-module bindings that receive walked raw records.
 * Shape: ctx.dataset = { datasetId, records: { "people:1": { … }, "meetings:2": { … } } }
 */

/** @param {Record<string, unknown> | undefined} records */
export function recordsByDataset(records) {
  /** @type {Record<string, Record<string, unknown>[]>} */
  const out = {};
  if (!records) return out;
  for (const [key, row] of Object.entries(records)) {
    const sep = key.indexOf(":");
    if (sep <= 0) continue;
    const datasetId = key.slice(0, sep);
    if (!out[datasetId]) out[datasetId] = [];
    out[datasetId].push(row);
  }
  return out;
}

/**
 * @param {Record<string, unknown> | undefined} records
 * @param {string} datasetId
 */
export function uidMap(records, datasetId) {
  /** @type {Map<number, Record<string, unknown>>} */
  const map = new Map();
  if (!records) return map;
  const prefix = `${datasetId}:`;
  for (const [key, row] of Object.entries(records)) {
    if (!key.startsWith(prefix)) continue;
    const uid = Number(key.slice(prefix.length));
    if (Number.isInteger(uid) && uid > 0) map.set(uid, row);
  }
  return map;
}

/** @param {unknown} value */
export function refUids(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === "number" && Number.isInteger(v) && v > 0);
  }
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? [value] : [];
}
