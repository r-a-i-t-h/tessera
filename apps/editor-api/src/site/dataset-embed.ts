import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  collectBindingDatasetIds,
  DATASET_RECORD_ID,
  datasetFileToSnapshot,
  expandDatasetIdsWithRefs,
  parseDatasetFile,
  type DatasetSnapshot,
  type SiteDocument,
} from "@r-a-i-t-h/tessera-model";

async function readDatasetFile(datasetsDir: string, id: string): Promise<DatasetSnapshot | undefined> {
  if (!DATASET_RECORD_ID.test(id)) return undefined;
  try {
    const raw = JSON.parse(await readFile(join(datasetsDir, `${id}.json`), "utf8")) as unknown;
    const file = parseDatasetFile(raw);
    if (file.id !== id) return undefined;
    return datasetFileToSnapshot(file);
  } catch {
    return undefined;
  }
}

/**
 * Attach dataset snapshots referenced by bindings (plus ref-linked datasets) to a flattened document.
 */
export async function embedDatasetsInDocument(
  siteRoot: string,
  doc: SiteDocument,
): Promise<SiteDocument> {
  const datasetsDir = join(siteRoot, "datasets");
  const seedIds = collectBindingDatasetIds(doc);
  if (!seedIds.length) {
    if (doc.datasets && Object.keys(doc.datasets).length) {
      const { datasets: _drop, ...rest } = doc;
      return rest as SiteDocument;
    }
    return doc;
  }

  const loaded: Record<string, DatasetSnapshot> = {};
  for (const id of seedIds) {
    const snap = await readDatasetFile(datasetsDir, id);
    if (snap) loaded[id] = snap;
  }

  const allIds = expandDatasetIdsWithRefs(loaded, Object.keys(loaded));
  for (const id of allIds) {
    if (loaded[id]) continue;
    const snap = await readDatasetFile(datasetsDir, id);
    if (snap) loaded[id] = snap;
  }

  return { ...doc, datasets: loaded };
}
