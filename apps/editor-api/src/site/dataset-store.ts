import { mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  adaptRecords,
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
  type DatasetSchemaBody,
  DATASET_RECORD_ID,
} from "@r-a-i-t-h/tessera-model";
import { readJson, writeTextAtomic } from "../store/fs.js";
import { isRecordId } from "./kinds.js";

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
  }

  async list(): Promise<DatasetSummary[]> {
    await this.ensureDir();
    let names: string[];
    try {
      names = await readdir(this.datasetsDir);
    } catch {
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
    return out.sort((a, b) => {
      const byTitle = titleKey(a).localeCompare(titleKey(b), undefined, { sensitivity: "base" });
      return byTitle !== 0 ? byTitle : a.id.localeCompare(b.id, undefined, { sensitivity: "base" });
    });
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
  }

  private assignNestedUids(record: Record<string, unknown>, file: DatasetFile, rootModified: { touched: boolean }): void {
    const walk = (obj: Record<string, unknown>, fields: DatasetSchemaBody["fields"]): void => {
      for (const field of fields) {
        if (field.kind !== "list") continue;
        const items = obj[field.id];
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          if (!item || typeof item !== "object" || Array.isArray(item)) continue;
          const row = item as Record<string, unknown>;
          if (typeof row.uid !== "number") {
            row.uid = file.nextUid++;
            const t = nowIso();
            row.added = t;
            row.modified = t;
            rootModified.touched = true;
          }
          walk(row, field.fields ?? []);
        }
      }
    };
    walk(record, file.schema.fields);
  }

  private normalizeRootRecord(
    incoming: Record<string, unknown>,
    existing: DatasetRootRecord | undefined,
    file: DatasetFile,
  ): DatasetRootRecord {
    const cleaned = stripEmptyOptionalFields({ ...incoming }, file.schema.fields);
    delete cleaned.added;
    delete cleaned.modified;

    const rootModified = { touched: false };
    if (existing) {
      cleaned.uid = existing.uid;
      cleaned.added = existing.added;
    } else {
      cleaned.uid = file.nextUid++;
      const t = nowIso();
      cleaned.added = t;
      cleaned.modified = t;
    }

    this.assignNestedUids(cleaned, file, rootModified);

    if (existing) {
      cleaned.modified = nowIso();
    }

    const rootFieldIds = new Set(file.schema.fields.map((f) => f.id));
    if (!rootFieldIds.has("id")) delete cleaned.id;
    if (!rootFieldIds.has("title")) delete cleaned.title;

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

export function datasetStoreForSiteRoot(siteRoot: string): DatasetStore {
  return new DatasetStore(join(siteRoot, "datasets"));
}
