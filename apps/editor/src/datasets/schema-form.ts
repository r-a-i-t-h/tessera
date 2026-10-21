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

export function schemaDraftFromFields(fields: DatasetField[]): SchemaDraft {
  return { fields: structuredClone(fields) };
}

export function renderSchemaForm(draft: SchemaDraft): string {
  const rows = draft.fields.map((field, index) => fieldRow(field, index, 0)).join("");
  const kinds = DATASET_FIELD_KINDS.map(
    (k) => `<option value="${k}">${k}</option>`,
  ).join("");
  const list = rows || `<li class="w3-text-grey">No fields yet.</li>`;
  return `<div class="editor-dataset-schema">
    <ul class="editor-type-fields editor-dataset-schema-custom-fields">${list}</ul>
    <p><button type="button" class="w3-button w3-small w3-theme" data-schema-action="add">Add field</button></p>
    <template id="schema-kind-options">${kinds}</template>
  </div>`;
}

function fieldRow(field: DatasetField, index: number, depth: number): string {
  const prefix = depth ? "editor-dataset-nested" : "";
  const nested =
    field.kind === "object" || field.kind === "list"
      ? `<ul class="editor-type-fields ${prefix}">${(field.fields ?? [])
          .map((child, i) => fieldRow(child, i, depth + 1))
          .join("")}</ul>
         <p><button type="button" class="w3-button w3-tiny" data-schema-add-nested="${index}" data-depth="${depth}">Add nested field</button></p>`
      : "";
  const enumOpts =
    field.kind === "enum"
      ? `<p><label>Options (value|label per line) <textarea class="w3-input w3-border" rows="3" data-schema-enum="${index}" data-depth="${depth}">${escapeHtml(
          (field.options ?? []).map((o) => `${o.value}|${o.label}`).join("\n"),
        )}</textarea></label></p>`
      : "";
  const refDs =
    field.kind === "ref"
      ? `<p><label>Dataset <input class="w3-input" data-schema-dataset="${index}" data-depth="${depth}" value="${escapeHtml(field.dataset ?? "")}" /></label></p>`
      : "";
  const many = field.kind === "asset" ? `<label><input type="checkbox" data-schema-many="${index}" data-depth="${depth}"${field.many ? " checked" : ""} /> Many</label>` : "";
  const kindOptions = DATASET_FIELD_KINDS.map(
    (k) => `<option value="${k}"${field.kind === k ? " selected" : ""}>${k}</option>`,
  ).join("");
  return `<li class="editor-type-item" data-schema-index="${index}" data-schema-depth="${depth}">
    <input type="hidden" data-schema-key="${index}" data-depth="${depth}" value="${escapeHtml(field.key)}" />
    <div class="editor-type-line">
      <input class="w3-input" placeholder="Field id" data-schema-id="${index}" data-depth="${depth}" value="${escapeHtml(field.id)}" />
      <input class="w3-input" placeholder="Label" data-schema-label="${index}" data-depth="${depth}" value="${escapeHtml(field.label)}" />
      <select class="w3-select" data-schema-kind="${index}" data-depth="${depth}">${kindOptions}</select>
      <label><input type="checkbox" data-schema-required="${index}" data-depth="${depth}"${field.required ? " checked" : ""} /> Required</label>
      ${many}
      ${actions(index, depth)}
    </div>
    ${refDs}
    ${enumOpts}
    ${nested}
  </li>`;
}

function actions(index: number, depth: number): string {
  return `<span class="editor-type-actions">
    ${schemaIcon("up", index, depth)}
    ${schemaIcon("down", index, depth)}
    ${schemaIcon("remove", index, depth)}
  </span>`;
}

function schemaIcon(action: "up" | "down" | "remove", index: number, depth: number): string {
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
    extraAttributes: ` data-schema-depth="${depth}"`,
  });
}

export function readSchemaForm(root: HTMLElement, draft: SchemaDraft): SchemaDraft {
  return { fields: readFieldsAtDepth(root, draft.fields, 0) };
}

function readFieldsAtDepth(root: HTMLElement, existing: DatasetField[], depth: number): DatasetField[] {
  const list =
    depth === 0
      ? root.querySelector(".editor-dataset-schema-custom-fields")
      : root.querySelector(":scope > ul.editor-type-fields");
  const rows = [...(list?.querySelectorAll<HTMLElement>(":scope > li[data-schema-index]") ?? [])];
  const fields: DatasetField[] = [];
  for (const row of rows) {
    const index = Number(row.dataset.schemaIndex);
    const base = existing[index] ?? {
      key: newFieldKey(existing),
      id: "",
      label: "",
      kind: "string" as DatasetFieldKind,
    };
    const scoped = `[data-depth="${depth}"]`;
    const kind = row.querySelector<HTMLSelectElement>(`[data-schema-kind="${index}"]${scoped}`)?.value as DatasetFieldKind;
    const field: DatasetField = {
      ...base,
      key: row.querySelector<HTMLInputElement>(`[data-schema-key="${index}"]${scoped}`)?.value || base.key,
      id: row.querySelector<HTMLInputElement>(`[data-schema-id="${index}"]${scoped}`)?.value.trim() ?? "",
      label: row.querySelector<HTMLInputElement>(`[data-schema-label="${index}"]${scoped}`)?.value ?? "",
      kind: kind ?? "string",
      required: row.querySelector<HTMLInputElement>(`[data-schema-required="${index}"]${scoped}`)?.checked === true,
    };
    if (field.kind === "asset") {
      field.many = row.querySelector<HTMLInputElement>(`[data-schema-many="${index}"]${scoped}`)?.checked === true;
    }
    if (field.kind === "ref") {
      field.dataset = row.querySelector<HTMLInputElement>(`[data-schema-dataset="${index}"]${scoped}`)?.value.trim();
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
    }
    if (field.kind === "object" || field.kind === "list") {
      const nestedRoot = document.createElement("div");
      const ul = row.querySelector("ul.editor-type-fields");
      if (ul) nestedRoot.appendChild(ul.cloneNode(true));
      field.fields = readFieldsAtDepth(nestedRoot, field.fields ?? [], depth + 1);
    }
    fields.push(field);
  }
  return fields;
}

/** Index path from root fields to a row (e.g. [0, 2] = third nested field under first root field). */
export function schemaRowPath(row: HTMLElement): number[] {
  const path: number[] = [];
  let li: HTMLElement | null = row;
  while (li?.matches("li[data-schema-index]")) {
    path.unshift(Number(li.dataset.schemaIndex));
    const parentField: HTMLElement | null =
      li.parentElement?.parentElement?.closest<HTMLElement>("li[data-schema-index]") ?? null;
    li = parentField;
  }
  return path;
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

function setFieldsAtPath(fields: DatasetField[], path: number[], nextList: DatasetField[]): DatasetField[] {
  if (path.length === 0) return nextList;
  const [head, ...rest] = path;
  return fields.map((field, i) => {
    if (i !== head) return field;
    if (rest.length === 0) return { ...field, fields: nextList };
    return { ...field, fields: setFieldsAtPath(field.fields ?? [], rest, nextList) };
  });
}

export function fieldListAtPath(fields: DatasetField[], path: number[]): DatasetField[] {
  let list = fields;
  for (const i of path) {
    list = list[i]?.fields ?? [];
  }
  return list;
}

export function focusSchemaFieldId(root: HTMLElement, depth: number, index: number): void {
  const input = root.querySelector<HTMLInputElement>(
    `input[data-schema-id="${index}"][data-depth="${depth}"]`,
  );
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
  const path = schemaRowPath(row);
  const index = path[path.length - 1] ?? 0;
  const parentPath = path.slice(0, -1);
  const current = fieldListAtPath(draft.fields, parentPath);
  const nextList = mutateFieldList(current, action, index);
  return { fields: setFieldsAtPath(draft.fields, parentPath, nextList) };
}

export function applyAddNestedField(draft: SchemaDraft, parentRow: HTMLElement): SchemaDraft {
  const parentPath = schemaRowPath(parentRow);
  const current = fieldListAtPath(draft.fields, parentPath);
  const nextList = mutateFieldList(current, "add", 0);
  return { fields: setFieldsAtPath(draft.fields, parentPath, nextList) };
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
