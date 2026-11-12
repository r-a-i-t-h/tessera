import { mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  adaptRecords,
  coerceCollectionValues,
  parseDatasetFile,
  parseDatasetSchema,
  sanitizeViewColumns,
  stripEmptyOptionalFields,
  summarizeSchemaAdaptation,
  validateAllRecords,
  validateRootRecord,
  validateDisplayNameTemplate,
  formatRecordDisplayName,
  type DatasetFile,
  type DatasetRootRecord,
  DATASET_RECORD_ID,
} from "@r-a-i-t-h/tessera-model";
import { readJson, writeTextAtomic } from "../store/fs.js";
import { isRecordId } from "./kinds.js";
import type { SiteStore } from "./store.js";

const writeQueues = new Map<string, Promise<void>>();

function queueWrite(path: string, fn: () => Promise<void>): Promise<void> {
  const previous = writeQueues.get(path) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(fn);
  writeQueues.set(path, next);
  return next.finally(() => {
    if (writeQueues.get(path) === next) writeQueues.delete(path);
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

function filePath(datasetsDir: string, id: string): string {
  return join(datasetsDir, `${id}.json`);
}

export type DatasetSummary = {
  id: string;
  title: string;
  recordCount: number;
  invalidCount: number;
};

export class DatasetStore {
  constructor(private readonly datasetsDir: string) {}

  private summaryCache: DatasetSummary[] | null = null;
  private listingGeneration = 0;

  listingVersion(): string {
    return String(this.listingGeneration);
  }

  /** Drop cached `/api/datasets` listings after writes that bypass the store (restore, reseed, …). */
  invalidateListing(): void {
    this.bumpSummaryCache();
  }

  private bumpSummaryCache(): void {
    this.summaryCache = null;
    this.listingGeneration += 1;
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.datasetsDir, { recursive: true });
  }

  private async readFile(id: string): Promise<DatasetFile> {
    const raw = await readJson<unknown>(filePath(this.datasetsDir, id));
    const file = parseDatasetFile(raw);
    if (file.id !== id) throw new Error("Dataset file id does not match its filename.");
    return file;
  }

  private async writeFile(file: DatasetFile): Promise<void> {
    const path = filePath(this.datasetsDir, file.id);
    await queueWrite(path, async () => {
      await writeTextAtomic(path, `${JSON.stringify(file, null, 2)}\n`);
    });
    this.bumpSummaryCache();
  }

  async list(): Promise<DatasetSummary[]> {
    if (this.summaryCache) return this.summaryCache;
    await this.ensureDir();
    let names: string[];
    try {
      names = await readdir(this.datasetsDir);
    } catch {
      this.summaryCache = [];
      return [];
    }
    const out: DatasetSummary[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const id = name.slice(0, -".json".length);
      if (!isRecordId(id)) continue;
      try {
        const file = await this.readFile(id);
        const invalid = validateAllRecords(file);
        out.push({
          id: file.id,
          title: file.title,
          recordCount: file.records.length,
          invalidCount: invalid.size,
        });
      } catch {
        continue;
      }
    }
    const titleKey = (row: DatasetSummary) => row.title.trim() || row.id;
    this.summaryCache = out.sort((a, b) => {
      const byTitle = titleKey(a).localeCompare(titleKey(b), undefined, { sensitivity: "base" });
      return byTitle !== 0 ? byTitle : a.id.localeCompare(b.id, undefined, { sensitivity: "base" });
    });
    return this.summaryCache;
  }

  async read(id: string): Promise<{ file: DatasetFile; issues: Map<number, { path: string; message: string }[]> }> {
    const file = await this.readFile(id);
    return { file, issues: validateAllRecords(file) };
  }

  async create(id: string, title: string): Promise<DatasetFile> {
    if (!isRecordId(id)) throw new Error("Dataset id is invalid.");
    await this.ensureDir();
    const path = filePath(this.datasetsDir, id);
    try {
      await readJson(path);
      throw new Error("A dataset with that id already exists.");
    } catch (err) {
      if (err instanceof Error && err.message.includes("already exists")) throw err;
    }
    const file: DatasetFile = {
      id,
      title: title.trim() || id,
      view: { columns: [], displayName: "" },
      schema: { fields: [] },
      nextUid: 1,
      records: [],
    };
    await this.writeFile(file);
    return file;
  }

  async duplicate(sourceId: string, nextId: string): Promise<DatasetFile> {
    if (!isRecordId(nextId)) throw new Error("Dataset id is invalid.");
    const source = await this.readFile(sourceId);
    const path = filePath(this.datasetsDir, nextId);
    try {
      await readJson(path);
      throw new Error("A dataset with that id already exists.");
    } catch (err) {
      if (err instanceof Error && err.message.includes("already exists")) throw err;
    }
    const file: DatasetFile = structuredClone(source);
    file.id = nextId;
    const baseTitle = source.title.trim() || source.id;
    file.title = baseTitle === source.id ? nextId : `${baseTitle} copy`;
    await this.writeFile(file);
    return file;
  }

  async updateTitle(id: string, title: string): Promise<DatasetFile> {
    const file = await this.readFile(id);
    file.title = title.trim() || file.id;
    await this.writeFile(file);
    return file;
  }

  async updateView(id: string, view: { columns: string[]; displayName?: string }): Promise<DatasetFile> {
    const file = await this.readFile(id);
    const displayName = view.displayName !== undefined ? view.displayName : (file.view.displayName ?? "");
    const templateError = validateDisplayNameTemplate(displayName, file.schema.fields);
    if (templateError) throw new Error(templateError);
    file.view = {
      columns: sanitizeViewColumns(view.columns, file.schema.fields),
      displayName,
    };
    await this.writeFile(file);
    return file;
  }

  async updateSchema(id: string, schemaRaw: unknown): Promise<{ file: DatasetFile; summary: ReturnType<typeof summarizeSchemaAdaptation> }> {
    const file = await this.readFile(id);
    const nextSchema = parseDatasetSchema(schemaRaw);
    const summary = summarizeSchemaAdaptation(file.schema, nextSchema);
    const uids = new Set(file.records.map((r) => r.uid));
    file.records = adaptRecords(file.schema, nextSchema, file.records, {
      rootUidsInDataset: (datasetId) => (datasetId === file.id ? uids : new Set()),
    });
    file.schema = nextSchema;
    const displayName = file.view.displayName ?? "";
    const templateError = validateDisplayNameTemplate(displayName, nextSchema.fields);
    if (templateError) throw new Error(templateError);
    file.view = {
      columns: sanitizeViewColumns(file.view.columns, nextSchema.fields),
      displayName,
    };
    await this.writeFile(file);
    return { file, summary };
  }

  async deleteDataset(id: string): Promise<void> {
    await unlink(filePath(this.datasetsDir, id));
    this.bumpSummaryCache();
  }

  private normalizeRootRecord(
    incoming: Record<string, unknown>,
    existing: DatasetRootRecord | undefined,
    file: DatasetFile,
  ): DatasetRootRecord {
    const cleaned = stripEmptyOptionalFields({ ...incoming }, file.schema.fields);
    coerceCollectionValues(cleaned, file.schema.fields);
    delete cleaned.added;
    delete cleaned.modified;

    if (existing) {
      cleaned.uid = existing.uid;
      cleaned.added = existing.added;
      cleaned.modified = nowIso();
    } else {
      cleaned.uid = file.nextUid++;
      const t = nowIso();
      cleaned.added = t;
      cleaned.modified = t;
    }

    const issues = validateRootRecord(cleaned, file.schema);
    if (issues.length) {
      throw new ValidationError(issues);
    }
    return cleaned as DatasetRootRecord;
  }

  async appendRecord(id: string, incoming: Record<string, unknown>): Promise<DatasetFile> {
    const file = await this.readFile(id);
    const record = this.normalizeRootRecord(incoming, undefined, file);
    file.records.push(record);
    await this.writeFile(file);
    return file;
  }

  async replaceRecord(id: string, uid: number, incoming: Record<string, unknown>): Promise<DatasetFile> {
    const file = await this.readFile(id);
    const index = file.records.findIndex((r) => r.uid === uid);
    if (index < 0) throw new Error("Record not found.");
    if (incoming.uid !== uid) throw new Error("Record uid cannot change.");
    const existing = file.records[index];
    const record = this.normalizeRootRecord(incoming, existing, file);
    file.records[index] = record;
    await this.writeFile(file);
    return file;
  }

  async patchRecords(id: string, items: { uid: number; record: Record<string, unknown> }[]): Promise<DatasetFile> {
    const file = await this.readFile(id);
    const nextRecords = file.records.map((r) => ({ ...r }));
    const byUid = new Map(nextRecords.map((r) => [r.uid, r]));

    const prepared: DatasetRootRecord[] = [];
    for (const item of items) {
      const existing = byUid.get(item.uid);
      if (!existing) throw new Error(`Unknown record uid ${item.uid}.`);
      if (item.record.uid !== item.uid) throw new Error("Record uid cannot change.");
      const record = this.normalizeRootRecord(item.record, existing, file);
      prepared.push(record);
    }

    for (const record of nextRecords) {
      const updated = prepared.find((p) => p.uid === record.uid);
      if (updated) Object.assign(record, updated);
    }

    for (const record of nextRecords) {
      coerceCollectionValues(record, file.schema.fields);
      const issues = validateRootRecord(record, file.schema);
      if (issues.length) throw new ValidationError(issues);
    }

    file.records = nextRecords;
    await this.writeFile(file);
    return file;
  }

  async deleteRecord(id: string, uid: number): Promise<DatasetFile> {
    const file = await this.readFile(id);
    const next = file.records.filter((r) => r.uid !== uid);
    if (next.length === file.records.length) throw new Error("Record not found.");
    file.records = next;
    await this.writeFile(file);
    return file;
  }

  async replaceRecordsRaw(id: string, raw: string): Promise<DatasetFile> {
    const text = raw.trim();
    if (!text) throw new Error("Raw JSON is empty.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Raw JSON is not valid JSON.");
    }
    if (!Array.isArray(parsed)) throw new Error("Records must be a JSON array.");

    const file = await this.readFile(id);
    const byExisting = new Map(file.records.map((r) => [r.uid, r]));
    const seenUids = new Set<number>();
    const nextRecords: DatasetRootRecord[] = [];

    for (let index = 0; index < parsed.length; index++) {
      const item = parsed[index];
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error(`Record at index ${index} must be an object.`);
      }
      const incoming = { ...(item as Record<string, unknown>) };
      const uid = Number(incoming.uid);
      if (!Number.isInteger(uid) || uid < 1) {
        throw new Error(`Record at index ${index} needs a positive integer uid.`);
      }
      if (seenUids.has(uid)) throw new Error(`Duplicate uid ${uid}.`);
      seenUids.add(uid);

      const existing = byExisting.get(uid);
      const cleaned = stripEmptyOptionalFields(incoming, file.schema.fields);
      coerceCollectionValues(cleaned, file.schema.fields);
      delete cleaned.added;
      delete cleaned.modified;
      cleaned.uid = uid;
      if (existing) {
        cleaned.added = existing.added;
        cleaned.modified = nowIso();
      } else {
        const t = nowIso();
        cleaned.added = t;
        cleaned.modified = t;
      }
      const issues = validateRootRecord(cleaned, file.schema);
      if (issues.length) throw new ValidationError(issues);
      nextRecords.push(cleaned as DatasetRootRecord);
    }

    file.records = nextRecords;
    file.nextUid = nextRecords.length ? Math.max(...nextRecords.map((r) => r.uid)) + 1 : 1;
    await this.writeFile(file);
    return file;
  }

  /** Removes every row; schema and view are unchanged. Resets the uid counter. */
  async clearAllRecords(id: string): Promise<DatasetFile> {
    const file = await this.readFile(id);
    if (file.records.length === 0) return file;
    file.records = [];
    file.nextUid = 1;
    await this.writeFile(file);
    return file;
  }

  /** Root uids for ref pickers and display. */
  async rootRecords(id: string): Promise<{ uid: number; displayName: string }[]> {
    const file = await this.readFile(id);
    return file.records.map((r) => ({
      uid: r.uid,
      displayName: formatRecordDisplayName(r, file.view.displayName ?? "", file.schema.fields),
    }));
  }
}

export class ValidationError extends Error {
  readonly issues: { path: string; message: string }[];

  constructor(issues: { path: string; message: string }[]) {
    super(issues.map((i) => `${i.path}: ${i.message}`).join(" "));
    this.name = "ValidationError";
    this.issues = issues;
  }
}

const datasetStores = new Map<string, DatasetStore>();

export function datasetStoreForSiteRoot(siteRoot: string): DatasetStore {
  const dir = join(siteRoot, "datasets");
  let store = datasetStores.get(dir);
  if (!store) {
    store = new DatasetStore(dir);
    datasetStores.set(dir, store);
  }
  return store;
}

/** Drop in-memory API listings after direct changes under `siteRoot`. */
export function invalidateSiteListings(site: SiteStore, siteRoot: string): void {
  site.invalidateListing();
  datasetStoreForSiteRoot(siteRoot).invalidateListing();
}
