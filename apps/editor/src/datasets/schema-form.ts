import {
  DATASET_FIELD_KINDS,
  newFieldKey,
  type DatasetField,
  type DatasetFieldKind,
} from "@r-a-i-t-h/tessera-model";
import { escapeHtml } from "../dom.js";
import { iconButton, REORDER_ICONS } from "../editor-icons.js";

export type SchemaDraft = {
  fields: DatasetField[];
};

export type DatasetRefOption = { id: string; title: string };

export type SchemaFormOptions = {
  datasetOptions?: DatasetRefOption[];
  /** Omit self when picking ref targets. */
  excludeDatasetId?: string;
};

export function schemaDraftFromFields(fields: DatasetField[]): SchemaDraft {
  return { fields: structuredClone(fields) };
}

export function renderSchemaForm(draft: SchemaDraft, options: SchemaFormOptions = {}): string {
  const rows = draft.fields.map((field, index) => fieldRow(field, index, options)).join("");
  const kinds = DATASET_FIELD_KINDS.map((k) => `<option value="${k}">${k}</option>`).join("");
  const list = rows || `<li class="w3-text-grey">No fields yet.</li>`;
  return `<div class="editor-dataset-schema">
    <ul class="editor-type-fields editor-dataset-schema-custom-fields">${list}</ul>
    <p><button type="button" class="w3-button w3-small w3-theme" data-schema-action="add">Add field</button></p>
    <template id="schema-kind-options">${kinds}</template>
  </div>`;
}

function fieldRow(field: DatasetField, index: number, options: SchemaFormOptions): string {
  const enumOpts =
    field.kind === "enum"
      ? `<p><label>Options (value|label per line) <textarea class="w3-input w3-border" rows="3" data-schema-enum="${index}" data-depth="0">${escapeHtml(
          (field.options ?? []).map((o) => `${o.value}|${o.label}`).join("\n"),
        )}</textarea></label></p>`
      : "";
  const refDs = field.kind === "ref" ? refDatasetControl(field, index, options) : "";
  const many =
    field.kind === "asset"
      ? `<label><input type="checkbox" data-schema-many="${index}" data-depth="0"${field.many ? " checked" : ""} /> Many</label>`
      : "";
  const kindOptions = DATASET_FIELD_KINDS.map(
    (k) => `<option value="${k}"${field.kind === k ? " selected" : ""}>${k}</option>`,
  ).join("");
  return `<li class="editor-type-item" data-schema-index="${index}" data-schema-depth="0">
    <input type="hidden" data-schema-key="${index}" data-depth="0" value="${escapeHtml(field.key)}" />
    <div class="editor-type-line">
      <input class="w3-input" placeholder="Field id" data-schema-id="${index}" data-depth="0" value="${escapeHtml(field.id)}" />
      <input class="w3-input" placeholder="Label" data-schema-label="${index}" data-depth="0" value="${escapeHtml(field.label)}" />
      <select class="w3-select" data-schema-kind="${index}" data-depth="0">${kindOptions}</select>
      <label><input type="checkbox" data-schema-required="${index}" data-depth="0"${field.required ? " checked" : ""} /> Required</label>
      ${many}
      ${actions(index)}
    </div>
    ${refDs}
    ${enumOpts}
  </li>`;
}

function refDatasetControl(field: DatasetField, index: number, options: SchemaFormOptions): string {
  const datasets = (options.datasetOptions ?? []).filter((d) => d.id !== options.excludeDatasetId);
  const selected = field.dataset ?? "";
  const opts = [
    `<option value="">— choose dataset —</option>`,
    ...datasets.map((d) => {
      const label = d.title.trim() || d.id;
      return `<option value="${escapeHtml(d.id)}"${d.id === selected ? " selected" : ""}>${escapeHtml(label)} (${escapeHtml(d.id)})</option>`;
    }),
  ].join("");
  return `<p><label>Dataset <select class="w3-select" data-schema-dataset="${index}" data-depth="0">${opts}</select></label></p>`;
}

function actions(index: number): string {
  return `<span class="editor-type-actions">
    ${schemaIcon("up", index)}
    ${schemaIcon("down", index)}
    ${schemaIcon("remove", index)}
  </span>`;
}

function schemaIcon(action: "up" | "down" | "remove", index: number): string {
  const labels = { up: "Up", down: "Down", remove: "Remove" } as const;
  const icons = { up: REORDER_ICONS.up, down: REORDER_ICONS.down, remove: REORDER_ICONS.remove } as const;
  return iconButton({
    className: "editor-type-icon",
    label: labels[action],
    actionAttribute: "data-schema-row-action",
    action,
    indexAttribute: "data-schema-index",
    index,
    icon: icons[action],
    extraAttributes: ` data-schema-depth="0"`,
  });
}

export function readSchemaForm(root: HTMLElement, draft: SchemaDraft): SchemaDraft {
  const list = root.querySelector(".editor-dataset-schema-custom-fields");
  const rows = [...(list?.querySelectorAll<HTMLElement>(":scope > li[data-schema-index]") ?? [])];
  const fields: DatasetField[] = [];
  for (const row of rows) {
    const index = Number(row.dataset.schemaIndex);
    const base =
      draft.fields[index] ?? {
        key: newFieldKey([...draft.fields, ...fields]),
        id: "",
        label: "",
        kind: "string" as DatasetFieldKind,
      };
    const scoped = `[data-depth="0"]`;
    const line = row.querySelector(".editor-type-line") ?? row;
    const kindEl = line.querySelector<HTMLSelectElement>(`[data-schema-kind="${index}"]${scoped}`);
    const kindFromDom = (kindEl?.value.trim() || "") as DatasetFieldKind | "";
    const resolvedKind = (kindFromDom || base.kind || "string") as DatasetFieldKind;
    const field: DatasetField = {
      ...base,
      key: row.querySelector<HTMLInputElement>(`[data-schema-key="${index}"]${scoped}`)?.value || base.key,
      id: line.querySelector<HTMLInputElement>(`[data-schema-id="${index}"]${scoped}`)?.value.trim() ?? "",
      label: line.querySelector<HTMLInputElement>(`[data-schema-label="${index}"]${scoped}`)?.value.trim() ?? "",
      kind: resolvedKind,
      required: line.querySelector<HTMLInputElement>(`[data-schema-required="${index}"]${scoped}`)?.checked === true,
    };
    delete field.fields;
    if (field.kind === "asset") {
      field.many = line.querySelector<HTMLInputElement>(`[data-schema-many="${index}"]${scoped}`)?.checked === true;
    }
    if (field.kind === "ref") {
      const picked = row
        .querySelector<HTMLSelectElement>(`[data-schema-dataset="${index}"]${scoped}`)
        ?.value.trim();
      field.dataset = picked || base.dataset;
    } else {
      delete field.dataset;
    }
    if (field.kind === "enum") {
      const text = row.querySelector<HTMLTextAreaElement>(`[data-schema-enum="${index}"]${scoped}`)?.value ?? "";
      field.options = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [value, label] = line.split("|");
          return { value: (value ?? "").trim(), label: (label ?? value ?? "").trim() };
        })
        .filter((o) => o.value);
    } else {
      delete field.options;
    }
    fields.push(field);
  }
  return { fields };
}

export function schemaRowPath(row: HTMLElement): number[] {
  const index = Number(row.dataset.schemaIndex);
  return Number.isInteger(index) ? [index] : [];
}

function mutateFieldList(fields: DatasetField[], action: string, index: number): DatasetField[] {
  const list = [...fields];
  if (action === "add") {
    list.push({ key: newFieldKey(list), id: "", label: "", kind: "string" });
    return list;
  }
  if (action === "remove") return list.filter((_, i) => i !== index);
  if (action === "up" && index > 0) {
    [list[index - 1], list[index]] = [list[index]!, list[index - 1]!];
    return list;
  }
  if (action === "down" && index < list.length - 1) {
    [list[index + 1], list[index]] = [list[index]!, list[index + 1]!];
    return list;
  }
  return list;
}

export function focusSchemaFieldId(root: HTMLElement, _depth: number, index: number): void {
  const input = root.querySelector<HTMLInputElement>(`input[data-schema-id="${index}"][data-depth="0"]`);
  if (!input) return;
  queueMicrotask(() => {
    input.focus();
    input.select();
  });
}

export function applySchemaAction(draft: SchemaDraft, action: string, index: number): SchemaDraft {
  return { fields: mutateFieldList(draft.fields, action, index) };
}

export function applySchemaActionForRow(draft: SchemaDraft, row: HTMLElement, action: string): SchemaDraft {
  const index = schemaRowPath(row)[0] ?? 0;
  return applySchemaAction(draft, action, index);
}

export function validateSchemaDraft(fields: DatasetField[]): string | undefined {
  for (const field of fields) {
    if (!field.id.trim()) return "Each field needs an id.";
    if (field.kind === "ref" && !field.dataset?.trim()) {
      return `Ref field "${field.id}" needs a target dataset.`;
    }
  }
  return undefined;
}

export function adaptationSummaryHtml(summary: {
  renames: { from: string; to: string }[];
  removals: { id: string }[];
  defaultsApplied: { id: string }[];
}): string {
  const parts: string[] = [];
  if (summary.renames.length) {
    parts.push(`<p>Renames: ${summary.renames.map((r) => `${escapeHtml(r.from)} → ${escapeHtml(r.to)}`).join(", ")}</p>`);
  }
  if (summary.removals.length) {
    parts.push(`<p>Removed: ${summary.removals.map((r) => escapeHtml(r.id)).join(", ")}</p>`);
  }
  if (summary.defaultsApplied.length) {
    parts.push(`<p>Defaults: ${summary.defaultsApplied.map((r) => escapeHtml(r.id)).join(", ")}</p>`);
  }
  return parts.join("") || "<p>No record changes.</p>";
}
