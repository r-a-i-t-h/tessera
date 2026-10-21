import { z } from "zod";

/** Same rule as editor-api record ids — one path segment. */
export const DATASET_RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Schema field ids that map to record metadata, not user-defined columns. */
export const DATASET_RESERVED_FIELD_IDS = ["uid", "added", "modified"] as const;

export const DATASET_MAX_FIELD_DEPTH = 4;

export const DATASET_SCALAR_KINDS = [
  "string",
  "text",
  "html",
  "number",
  "boolean",
  "date",
  "enum",
  "asset",
  "ref",
] as const;

export const DATASET_FIELD_KINDS = [...DATASET_SCALAR_KINDS, "object", "list"] as const;

export type DatasetScalarKind = (typeof DATASET_SCALAR_KINDS)[number];
export type DatasetFieldKind = (typeof DATASET_FIELD_KINDS)[number];

export type DatasetEnumOption = { value: string; label: string };

export type DatasetField = {
  key: string;
  id: string;
  label: string;
  kind: DatasetFieldKind;
  required?: boolean;
  default?: unknown;
  many?: boolean;
  options?: DatasetEnumOption[];
  dataset?: string;
  labelField?: string;
  fields?: DatasetField[];
};

export type DatasetSchemaBody = {
  fields: DatasetField[];
};

export type DatasetView = {
  columns: string[];
  /** e.g. `{make} {model} {year}` — see `formatRecordDisplayName`. */
  displayName?: string;
};

export type DatasetRootRecord = Record<string, unknown> & {
  uid: number;
  added: string;
  modified: string;
};

export type RecordDisplayContext = {
  refLabel?: (datasetId: string, uid: number) => string;
  assetLabel?: (assetId: string) => string;
};

const DISPLAY_NAME_PLACEHOLDER = /\{([A-Za-z0-9_]+)\}/g;

export type DatasetFile = {
  id: string;
  title: string;
  view: DatasetView;
  schema: DatasetSchemaBody;
  nextUid: number;
  records: DatasetRootRecord[];
};

export type DatasetValidationIssue = { path: string; message: string };

export type AdaptRecordsContext = {
  /** Root record uids in a dataset file, for ref field migration. */
  rootUidsInDataset: (datasetId: string) => ReadonlySet<number>;
};

export type SchemaAdaptationSummary = {
  renames: { key: string; from: string; to: string }[];
  removals: { key: string; id: string }[];
  defaultsApplied: { key: string; id: string }[];
};

const EnumOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string(),
});

const FieldKindSchema = z.enum(DATASET_FIELD_KINDS);

function fieldDepth(fields: DatasetField[], depth = 1): number {
  let max = depth;
  for (const field of fields) {
    if (field.kind === "object" || field.kind === "list") {
      const nested = field.fields ?? [];
      max = Math.max(max, fieldDepth(nested, depth + 1));
    }
  }
  return max;
}

function fieldIdReserved(id: string): boolean {
  return (DATASET_RESERVED_FIELD_IDS as readonly string[]).includes(id);
}

function parseField(raw: unknown, depth: number): DatasetField {
  if (!raw || typeof raw !== "object") throw new Error("Field must be an object.");
  const o = raw as Record<string, unknown>;
  const key = typeof o.key === "string" ? o.key.trim() : "";
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const label = typeof o.label === "string" ? o.label : id;
  const kind = FieldKindSchema.parse(o.kind);
  if (!key) throw new Error("Each field needs a key.");
  if (!id) throw new Error("Each field needs an id.");
  if (fieldIdReserved(id)) throw new Error(`Field id ${id} is reserved.`);
  if (!DATASET_RECORD_ID.test(id)) throw new Error(`Field id ${id} is invalid.`);

  const field: DatasetField = { key, id, label, kind };
  if (o.required === true) field.required = true;

  if (kind === "enum") {
    const options = z.array(EnumOptionSchema).min(1).parse(o.options);
    field.options = options;
  }
  if (kind === "ref") {
    const dataset = typeof o.dataset === "string" ? o.dataset.trim() : "";
    if (!dataset || !DATASET_RECORD_ID.test(dataset)) throw new Error("Ref field needs a valid dataset id.");
    field.dataset = dataset;
  }
  if (kind === "asset" && o.many === true) field.many = true;
  if (kind === "list" && typeof o.labelField === "string" && o.labelField.trim()) {
    field.labelField = o.labelField.trim();
  }

  if (kind === "object" || kind === "list") {
    if (depth >= DATASET_MAX_FIELD_DEPTH) throw new Error(`Fields cannot nest deeper than ${DATASET_MAX_FIELD_DEPTH} levels.`);
    const nested = Array.isArray(o.fields) ? o.fields.map((f) => parseField(f, depth + 1)) : [];
    field.fields = nested;
  }

  if ("default" in o) field.default = o.default;

  validateFieldDefault(field);
  return field;
}

function validateFieldDefault(field: DatasetField): void {
  if (field.default === undefined) return;
  if (field.kind === "object" || field.kind === "list") {
    throw new Error(`Default is not allowed on ${field.kind} field ${field.id}.`);
  }
  if (!valueMatchesField(field, field.default, true)) {
    throw new Error(`Default on ${field.id} does not match its kind.`);
  }
}

export function parseDatasetFields(raw: unknown): DatasetField[] {
  if (!Array.isArray(raw)) throw new Error("Schema fields must be an array.");
  const fields = raw.map((f) => parseField(f, 1));
  assertUniqueFieldKeys(fields);
  assertUniqueFieldIds(fields);
  if (fieldDepth(fields) > DATASET_MAX_FIELD_DEPTH) {
    throw new Error(`Fields cannot nest deeper than ${DATASET_MAX_FIELD_DEPTH} levels.`);
  }
  return fields;
}

function assertUniqueFieldKeys(fields: DatasetField[]): void {
  const seen = new Set<string>();
  walkFields(fields, (f) => {
    if (seen.has(f.key)) throw new Error(`Field key ${f.key} is listed twice.`);
    seen.add(f.key);
  });
}

function assertUniqueFieldIds(fields: DatasetField[]): void {
  const seen = new Set<string>();
  walkFields(fields, (f) => {
    if (seen.has(f.id)) throw new Error(`Field id ${f.id} is listed twice.`);
    seen.add(f.id);
  });
}

function walkFields(fields: DatasetField[], fn: (f: DatasetField) => void): void {
  for (const field of fields) {
    fn(field);
    if (field.fields?.length) walkFields(field.fields, fn);
  }
}

export function parseDatasetSchema(raw: unknown): DatasetSchemaBody {
  if (!raw || typeof raw !== "object") throw new Error("Schema must be an object.");
  const fields = parseDatasetFields((raw as { fields?: unknown }).fields ?? []);
  return { fields };
}

export function parseDatasetFile(raw: unknown): DatasetFile {
  if (!raw || typeof raw !== "object") throw new Error("Dataset file must be an object.");
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const title = typeof o.title === "string" ? o.title : "";
  if (!id || !DATASET_RECORD_ID.test(id)) throw new Error("Dataset id is invalid.");
  const schema = parseDatasetSchema(o.schema);
  const viewRaw = o.view && typeof o.view === "object" ? (o.view as { columns?: unknown; displayName?: unknown }) : {};
  const columns = Array.isArray(viewRaw.columns)
    ? viewRaw.columns.filter((c): c is string => typeof c === "string")
    : [];
  const displayName = typeof viewRaw.displayName === "string" ? viewRaw.displayName : "";
  const nextUid = typeof o.nextUid === "number" && Number.isInteger(o.nextUid) && o.nextUid >= 1 ? o.nextUid : 1;
  const records = Array.isArray(o.records)
    ? o.records.map((r) => scrubLegacyRootRecord(r as Record<string, unknown>))
    : [];
  const view: DatasetView = {
    columns: sanitizeViewColumns(columns, schema.fields),
    displayName,
  };
  const templateError = validateDisplayNameTemplate(displayName, schema.fields);
  if (templateError) throw new Error(templateError);
  return {
    id,
    title,
    view,
    schema,
    nextUid,
    records,
  };
}

function scrubLegacyRootRecord(raw: Record<string, unknown>): DatasetRootRecord {
  const copy = { ...raw };
  delete copy.id;
  delete copy.title;
  return copy as DatasetRootRecord;
}

export function sanitizeViewColumns(columns: readonly string[], fields: readonly DatasetField[]): string[] {
  const rootScalars = new Set(rootColumnFieldIds(fields));
  const meta = new Set<string>(["uid", "added", "modified"]);
  return columns.filter((c) => rootScalars.has(c) || meta.has(c));
}

export function rootColumnFieldIds(fields: readonly DatasetField[]): string[] {
  const out: string[] = [];
  for (const field of fields) {
    if (field.kind === "object" || field.kind === "list") continue;
    out.push(field.id);
  }
  return out;
}

export function fieldById(fields: readonly DatasetField[], id: string): DatasetField | undefined {
  let found: DatasetField | undefined;
  walkFields([...fields], (f) => {
    if (f.id === id) found = f;
  });
  return found;
}

export function displayNamePlaceholders(template: string): string[] {
  const out: string[] = [];
  for (const match of template.matchAll(DISPLAY_NAME_PLACEHOLDER)) {
    const key = match[1];
    if (key) out.push(key);
  }
  return [...new Set(out)];
}

export function validateDisplayNameTemplate(
  template: string,
  fields: readonly DatasetField[],
): string | undefined {
  const allowed = new Set([...rootColumnFieldIds(fields), "uid"]);
  for (const key of displayNamePlaceholders(template)) {
    if (!allowed.has(key)) return `Unknown field {${key}} in display name template.`;
  }
  return undefined;
}

function scalarDisplayValue(
  record: Record<string, unknown>,
  field: DatasetField,
  ctx?: RecordDisplayContext,
): string {
  const raw = record[field.id];
  if (raw === undefined || raw === null) return "";
  switch (field.kind) {
    case "boolean":
      return raw === true ? "Yes" : raw === false ? "No" : "";
    case "enum": {
      const opt = field.options?.find((o) => o.value === raw);
      return opt?.label ?? String(raw);
    }
    case "ref":
      return ctx?.refLabel?.(field.dataset ?? "", Number(raw)) ?? String(raw);
    case "asset":
      if (field.many && Array.isArray(raw)) {
        return raw.map((id) => ctx?.assetLabel?.(String(id)) ?? String(id)).join(", ");
      }
      return ctx?.assetLabel?.(String(raw)) ?? String(raw);
    case "html":
      return String(raw).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    case "text":
      return String(raw).replace(/\s+/g, " ").trim();
    default:
      return String(raw);
  }
}

export function formatRecordDisplayName(
  record: Record<string, unknown>,
  template: string,
  fields: readonly DatasetField[],
  ctx?: RecordDisplayContext,
): string {
  const trimmed = template.trim();
  if (!trimmed) {
    const uid = record.uid;
    return typeof uid === "number" ? `#${uid}` : "Record";
  }
  const text = trimmed.replace(DISPLAY_NAME_PLACEHOLDER, (_full, key: string) => {
    if (key === "uid") return String(record.uid ?? "");
    const field = fieldById(fields, key);
    if (!field || field.kind === "object" || field.kind === "list") return "";
    return scalarDisplayValue(record, field, ctx);
  });
  return text.replace(/\s+/g, " ").trim();
}

export function newFieldKey(existing: readonly DatasetField[]): string {
  const used = new Set<string>();
  walkFields([...existing], (f) => used.add(f.key));
  let n = 1;
  while (used.has(`f${n}`)) n += 1;
  return `f${n}`;
}

function isIsoTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function validateSystemRoot(record: Record<string, unknown>): DatasetValidationIssue[] {
  const issues: DatasetValidationIssue[] = [];
  if (typeof record.uid !== "number" || !Number.isInteger(record.uid) || record.uid < 1) {
    issues.push({ path: "uid", message: "uid must be a positive integer." });
  }
  if (typeof record.added !== "string" || !isIsoTimestamp(record.added)) {
    issues.push({ path: "added", message: "added must be an ISO timestamp." });
  }
  if (typeof record.modified !== "string" || !isIsoTimestamp(record.modified)) {
    issues.push({ path: "modified", message: "modified must be an ISO timestamp." });
  }
  return issues;
}

function validateSystemListItem(record: Record<string, unknown>, pathPrefix: string): DatasetValidationIssue[] {
  const issues: DatasetValidationIssue[] = [];
  const p = (suffix: string) => (pathPrefix ? `${pathPrefix}.${suffix}` : suffix);
  if (typeof record.uid !== "number" || !Number.isInteger(record.uid) || record.uid < 1) {
    issues.push({ path: p("uid"), message: "uid must be a positive integer." });
  }
  if (typeof record.added !== "string" || !isIsoTimestamp(record.added)) {
    issues.push({ path: p("added"), message: "added must be an ISO timestamp." });
  }
  if (typeof record.modified !== "string" || !isIsoTimestamp(record.modified)) {
    issues.push({ path: p("modified"), message: "modified must be an ISO timestamp." });
  }
  return issues;
}

function valueMatchesField(field: DatasetField, value: unknown, forDefault = false): boolean {
  if (value === undefined || value === null) return !field.required && forDefault;
  switch (field.kind) {
    case "string":
    case "text":
    case "html":
    case "date":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "enum": {
      if (typeof value !== "string") return false;
      const opts = field.options ?? [];
      return opts.some((o) => o.value === value);
    }
    case "asset":
      if (field.many) {
        if (!Array.isArray(value)) return false;
        return value.every((v) => typeof v === "string" && v.length > 0);
      }
      return typeof value === "string" && value.length > 0;
    case "ref":
      return typeof value === "number" && Number.isInteger(value) && value > 0;
    case "object":
    case "list":
      return false;
    default:
      return false;
  }
}

function validateValueAtField(
  field: DatasetField,
  value: unknown,
  path: string,
): DatasetValidationIssue[] {
  const issues: DatasetValidationIssue[] = [];
  const present =
    field.kind === "boolean"
      ? value === true || value === false
      : value !== undefined && value !== null && value !== "";
  if (field.required && !present) {
    issues.push({ path, message: "Required." });
    return issues;
  }
  if (!present) return issues;

  if (field.kind === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      issues.push({ path, message: "Expected an object." });
      return issues;
    }
    issues.push(...validateObjectFields(field.fields ?? [], value as Record<string, unknown>, path));
    return issues;
  }

  if (field.kind === "list") {
    if (!Array.isArray(value)) {
      issues.push({ path, message: "Expected a list." });
      return issues;
    }
    value.forEach((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        issues.push({ path: `${path}.${index}`, message: "Expected a list item object." });
        return;
      }
      issues.push(...validateSystemListItem(item as Record<string, unknown>, `${path}.${index}`));
      issues.push(
        ...validateObjectFields(field.fields ?? [], item as Record<string, unknown>, `${path}.${index}`),
      );
    });
    return issues;
  }

  if (!valueMatchesField(field, value)) {
    issues.push({ path, message: `Value does not match ${field.kind}.` });
  }
  if (field.kind === "date" && typeof value === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    issues.push({ path, message: "Date must be YYYY-MM-DD." });
  }
  return issues;
}

function validateObjectFields(
  fields: readonly DatasetField[],
  obj: Record<string, unknown>,
  pathPrefix: string,
): DatasetValidationIssue[] {
  const issues: DatasetValidationIssue[] = [];
  for (const field of fields) {
    const path = pathPrefix ? `${pathPrefix}.${field.id}` : field.id;
    issues.push(...validateValueAtField(field, obj[field.id], path));
  }
  return issues;
}

export function validateRootRecord(
  record: Record<string, unknown>,
  schema: DatasetSchemaBody,
): DatasetValidationIssue[] {
  const issues = validateSystemRoot(record);
  issues.push(...validateObjectFields(schema.fields, record, ""));
  return issues;
}

export function validateAllRecords(file: DatasetFile): Map<number, DatasetValidationIssue[]> {
  const map = new Map<number, DatasetValidationIssue[]>();
  for (const record of file.records) {
    const issues = validateRootRecord(record, file.schema);
    if (issues.length) map.set(record.uid, issues);
  }
  return map;
}

function textKinds(kind: DatasetFieldKind): boolean {
  return kind === "string" || kind === "text" || kind === "html";
}

function transformScalarValue(
  value: unknown,
  prev: DatasetField,
  next: DatasetField,
  ctx: AdaptRecordsContext,
): unknown {
  if (prev.key !== next.key) return value;

  if (textKinds(prev.kind) && textKinds(next.kind)) return value;

  if (prev.kind === "asset" && next.kind === "asset") {
    if (!prev.many && next.many) {
      if (typeof value === "string") return [value];
      return value;
    }
    if (prev.many && !next.many) {
      if (Array.isArray(value) && value.length) return value[0];
      return undefined;
    }
    return value;
  }

  if (prev.kind === "ref" && next.kind === "ref") {
    if (prev.dataset === next.dataset) return value;
    if (typeof value !== "number") return applyDefault(next);
    const uids = ctx.rootUidsInDataset(next.dataset ?? "");
    if (uids.has(value)) return value;
    return applyDefault(next);
  }

  if (prev.kind === next.kind) {
    if (next.kind === "enum" && typeof value === "string") {
      const opts = next.options ?? [];
      if (opts.some((o) => o.value === value)) return value;
      return applyDefault(next);
    }
    return value;
  }

  return applyDefault(next);
}

function applyDefault(field: DatasetField): unknown {
  if (field.default === undefined) return undefined;
  if (field.kind === "object" || field.kind === "list") return undefined;
  return structuredClone(field.default);
}

function adaptObjectFields(
  obj: Record<string, unknown>,
  prevFields: readonly DatasetField[],
  nextFields: readonly DatasetField[],
  ctx: AdaptRecordsContext,
  isListItem: boolean,
): Record<string, unknown> {
  const prevByKey = new Map(prevFields.map((f) => [f.key, f]));
  const out: Record<string, unknown> = isListItem
    ? {
        uid: obj.uid,
        added: obj.added,
        modified: obj.modified,
      }
    : {};

  for (const nextField of nextFields) {
    const prevField = prevByKey.get(nextField.key);
    if (!prevField) {
      const def = applyDefault(nextField);
      if (def !== undefined) out[nextField.id] = def;
      continue;
    }

    const oldId = prevField.id;
    let value = oldId in obj ? obj[oldId] : undefined;

    if (prevField.kind === "object" && nextField.kind === "object") {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        value = adaptObjectFields(
          value as Record<string, unknown>,
          prevField.fields ?? [],
          nextField.fields ?? [],
          ctx,
          false,
        );
      } else {
        value = undefined;
      }
    } else if (prevField.kind === "list" && nextField.kind === "list") {
      if (Array.isArray(value)) {
        value = value.map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return item;
          return adaptObjectFields(
            item as Record<string, unknown>,
            prevField.fields ?? [],
            nextField.fields ?? [],
            ctx,
            true,
          );
        });
      } else {
        value = undefined;
      }
    } else if (prevField.kind === nextField.kind && (prevField.kind === "object" || prevField.kind === "list")) {
      value = applyDefault(nextField);
    } else {
      value = transformScalarValue(value, prevField, nextField, ctx);
    }

    if (value !== undefined) out[nextField.id] = value;
  }

  return out;
}

export function adaptRecords(
  previous: DatasetSchemaBody,
  next: DatasetSchemaBody,
  records: readonly DatasetRootRecord[],
  ctx: AdaptRecordsContext,
): DatasetRootRecord[] {
  return records.map((record) => {
    const adapted = adaptObjectFields(record, previous.fields, next.fields, ctx, false);
    return {
      uid: record.uid,
      added: record.added,
      modified: record.modified,
      ...adapted,
    } as DatasetRootRecord;
  });
}

export function summarizeSchemaAdaptation(
  previous: DatasetSchemaBody,
  next: DatasetSchemaBody,
): SchemaAdaptationSummary {
  const prevByKey = new Map(previous.fields.map((f) => [f.key, f]));
  const nextByKey = new Map(next.fields.map((f) => [f.key, f]));
  const renames: SchemaAdaptationSummary["renames"] = [];
  const removals: SchemaAdaptationSummary["removals"] = [];
  const defaultsApplied: SchemaAdaptationSummary["defaultsApplied"] = [];

  for (const [key, prev] of prevByKey) {
    const n = nextByKey.get(key);
    if (!n) removals.push({ key, id: prev.id });
    else if (n.id !== prev.id) renames.push({ key, from: prev.id, to: n.id });
  }
  for (const [key, n] of nextByKey) {
    if (!prevByKey.has(key) && n.default !== undefined) {
      defaultsApplied.push({ key, id: n.id });
    }
  }
  walkFields(next.fields, (f) => {
    if (!prevByKey.has(f.key) && f.default !== undefined && !defaultsApplied.some((d) => d.key === f.key)) {
      defaultsApplied.push({ key: f.key, id: f.id });
    }
  });

  return { renames, removals, defaultsApplied };
}

export function emptyRootRecordDraft(schema: DatasetSchemaBody): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  applyDefaultsToObject(out, schema.fields);
  return out;
}

export function emptyListItemDraft(fields: readonly DatasetField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  applyDefaultsToObject(out, fields);
  return out;
}

function applyDefaultsToObject(obj: Record<string, unknown>, fields: readonly DatasetField[]): void {
  for (const field of fields) {
    if (field.default !== undefined) obj[field.id] = structuredClone(field.default);
  }
}

export function stripEmptyOptionalFields(
  obj: Record<string, unknown>,
  fields: readonly DatasetField[],
): Record<string, unknown> {
  const out = { ...obj };
  for (const field of fields) {
    if (field.kind === "object" || field.kind === "list") {
      if (field.kind === "list" && Array.isArray(out[field.id])) {
        out[field.id] = (out[field.id] as unknown[]).map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return item;
          return stripEmptyOptionalFields(item as Record<string, unknown>, field.fields ?? []);
        });
      }
      continue;
    }
    const v = out[field.id];
    if (v === undefined || v === null || v === "") delete out[field.id];
    if (field.kind === "boolean" && v === false && !field.required) delete out[field.id];
    if (field.many && Array.isArray(v) && v.length === 0) delete out[field.id];
  }
  return out;
}
