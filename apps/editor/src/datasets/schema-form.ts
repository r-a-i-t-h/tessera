import {
  DATASET_FIELD_KINDS,
  DATASET_RECORD_ID,
  DATASET_RESERVED_FIELD_IDS,
  DATASET_SCALAR_KINDS,
  newFieldKey,
  type DatasetField,
  type DatasetFieldKind,
} from "@r-a-i-t-h/tessera-model";
import { escapeHtml } from "../dom.js";
import { iconButton, INFO_ICON, REORDER_ICONS } from "../editor-icons.js";
import { availableViewColumns } from "./grid.js";

export type SchemaDraft = {
  fields: DatasetField[];
  /** Data-grid column ids; persisted with schema Save as `view.columns`. */
  viewColumns: string[];
};

export type DatasetRefOption = { id: string; title: string };

export type SchemaFormOptions = {
  datasetOptions?: DatasetRefOption[];
  /** Omit self when picking ref targets. */
  excludeDatasetId?: string;
  /** Column ids shown in the dataset grid (`view.columns`). */
  viewColumns?: readonly string[];
};

const SYSTEM_VIEW_COLUMNS = [
  { id: "uid", label: "UID" },
  { id: "added", label: "Added" },
  { id: "modified", label: "Modified" },
] as const;

function systemVisibleColumnsHtml(viewColumns: readonly string[] | undefined): string {
  const on = new Set(viewColumns ?? []);
  const rows = SYSTEM_VIEW_COLUMNS.map(
    ({ id, label }) =>
      `<li class="editor-dataset-schema-meta-row">
        <span class="editor-dataset-schema-meta-id">${escapeHtml(id)}</span>
        <span class="editor-dataset-schema-meta-label">${escapeHtml(label)}</span>
        <label class="editor-dataset-schema-visible-cell"><input type="checkbox" data-view-col="${escapeHtml(id)}"${on.has(id) ? " checked" : ""} /><span>Visible</span></label>
      </li>`,
  ).join("");
  return `<ul class="editor-dataset-schema-meta-visible" aria-label="Record metadata columns">${rows}</ul>`;
}

export function schemaDraftFromFields(fields: DatasetField[], viewColumns: readonly string[] = []): SchemaDraft {
  return { fields: structuredClone(fields), viewColumns: [...viewColumns] };
}

export function renderSchemaForm(draft: SchemaDraft, options: SchemaFormOptions = {}): string {
  const viewColumns = options.viewColumns ?? draft.viewColumns;
  const rowOptions = { ...options, viewColumns };
  const rows = draft.fields.map((field, index) => fieldRow(field, index, rowOptions)).join("");
  const kinds = DATASET_FIELD_KINDS.map((k) => `<option value="${k}">${k}</option>`).join("");
  const list = rows || `<li class="w3-text-grey">No fields yet.</li>`;
  return `<div class="editor-dataset-schema">
    ${systemVisibleColumnsHtml(viewColumns)}
    <ul class="editor-type-fields editor-dataset-schema-custom-fields">${list}</ul>
    <p><button type="button" class="w3-button w3-small w3-theme" data-action="add-field" data-schema-action="add">Add field</button></p>
    <template id="schema-kind-options">${kinds}</template>
  </div>`;
}

function fieldRow(field: DatasetField, index: number, options: SchemaFormOptions): string {
  const enumOpts =
    field.kind === "enum"
      ? enumOptionsEditor(field, `data-schema-enum="${index}" data-depth="0"`, `schema-enum-${index}`)
      : "";
  const refDs = field.kind === "ref" ? refDatasetControl(field, index, options, 0) : "";
  const many = `<label><input type="checkbox" data-schema-many="${index}" data-depth="0"${field.many ? " checked" : ""} /> Collection</label>`;
  const objectBlock =
    field.kind === "object"
      ? `<div class="editor-dataset-object-schema" data-schema-object="${index}">
        <p class="w3-small w3-text-grey">Subtype fields</p>
        <ul class="editor-type-fields">${(field.fields ?? []).map((sub, subIndex) => objectSubfieldRow(sub, index, subIndex, options)).join("")}</ul>
        <p><button type="button" class="w3-button w3-tiny w3-white w3-border" data-schema-object-add="${index}">Add subfield</button></p>
      </div>`
      : "";
  const kindOptions = DATASET_FIELD_KINDS.map(
    (k) => `<option value="${k}"${field.kind === k ? " selected" : ""}>${k}</option>`,
  ).join("");
  const visible = options.viewColumns?.includes(field.id) ?? false;
  return `<li class="editor-type-item" data-schema-index="${index}" data-schema-depth="0">
    <input type="hidden" data-schema-key="${index}" data-depth="0" value="${escapeHtml(field.key)}" />
    <div class="editor-type-line">
      <input class="w3-input" placeholder="Field id" data-schema-id="${index}" data-depth="0" value="${escapeHtml(field.id)}" />
      <input class="w3-input" placeholder="Label" data-schema-label="${index}" data-depth="0" value="${escapeHtml(field.label)}" />
      <select class="w3-select" data-schema-kind="${index}" data-depth="0">${kindOptions}</select>
      <label><input type="checkbox" data-schema-required="${index}" data-depth="0"${field.required ? " checked" : ""} /> Required</label>
      <label class="editor-dataset-schema-visible-cell"><input type="checkbox" data-schema-visible="${index}" data-depth="0"${visible ? " checked" : ""} /><span>Visible</span></label>
      ${many}
      ${actions(index)}
    </div>
    ${refDs}
    ${enumOpts}
    ${objectBlock}
  </li>`;
}

function objectSubfieldRow(
  field: DatasetField,
  parentIndex: number,
  subIndex: number,
  options: SchemaFormOptions,
): string {
  const kindOptions = [...DATASET_SCALAR_KINDS, "ref"]
    .map((k) => `<option value="${k}"${field.kind === k ? " selected" : ""}>${k}</option>`)
    .join("");
  const refDs = field.kind === "ref" ? refDatasetControl(field, parentIndex, options, 1, subIndex) : "";
  const enumOpts =
    field.kind === "enum"
      ? enumOptionsEditor(
          field,
          `data-schema-enum="${parentIndex}" data-schema-sub="${subIndex}" data-depth="1"`,
          `schema-enum-${parentIndex}-${subIndex}`,
        )
      : "";
  return `<li class="editor-type-item" data-schema-sub-index="${subIndex}">
    <input type="hidden" data-schema-sub-key="${parentIndex}" data-schema-sub="${subIndex}" data-depth="1" value="${escapeHtml(field.key)}" />
    <div class="editor-type-line">
      <input class="w3-input" placeholder="Subfield id" data-schema-sub-id="${parentIndex}" data-schema-sub="${subIndex}" data-depth="1" value="${escapeHtml(field.id)}" />
      <input class="w3-input" placeholder="Label" data-schema-sub-label="${parentIndex}" data-schema-sub="${subIndex}" data-depth="1" value="${escapeHtml(field.label)}" />
      <select class="w3-select" data-schema-sub-kind="${parentIndex}" data-schema-sub="${subIndex}" data-depth="1">${kindOptions}</select>
      ${subActions(parentIndex, subIndex)}
    </div>
    ${refDs}
    ${enumOpts}
  </li>`;
}

function enumOptionsEditor(field: DatasetField, attrs: string, id: string): string {
  const helpId = `${id}-help`;
  const body = escapeHtml((field.options ?? []).map((o) => (o.label && o.label !== o.value ? `${o.value}|${o.label}` : o.value)).join("\n"));
  return `<div class="editor-schema-enum">
    <div class="editor-schema-enum-head">
      <label for="${id}">Options</label>
      <span class="editor-schema-help">
        <button type="button" class="editor-schema-help-button" data-schema-help aria-label="Enum options format" aria-expanded="false" aria-controls="${helpId}">${INFO_ICON}</button>
        <div id="${helpId}" class="editor-schema-help-pop" role="note" hidden>
          <p>One option per line.</p>
          <p><code>value|label</code> stores <code>value</code> and shows <code>label</code>. A line without <code>|</code> uses the same text for both.</p>
          <pre>open|Open
closed|Closed
archived</pre>
        </div>
      </span>
    </div>
    <textarea id="${id}" class="w3-input w3-border" rows="3" ${attrs}>${body}</textarea>
  </div>`;
}

/** Open or close the format note next to an enum Options field. */
export function toggleSchemaHelp(button: HTMLButtonElement): void {
  const helpId = button.getAttribute("aria-controls");
  const pop = helpId ? button.ownerDocument.getElementById(helpId) : null;
  if (!(pop instanceof HTMLElement)) return;
  const willOpen = pop.hidden;
  closeSchemaHelp(button.ownerDocument);
  if (!willOpen) return;
  pop.hidden = false;
  button.setAttribute("aria-expanded", "true");
}

/** Close enum-format notes under `root`. Returns true when one was open. */
export function closeSchemaHelp(root: ParentNode): boolean {
  let closed = false;
  for (const pop of root.querySelectorAll<HTMLElement>(".editor-schema-help-pop")) {
    if (pop.hidden) continue;
    pop.hidden = true;
    closed = true;
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-schema-help][aria-expanded="true"]')) {
    button.setAttribute("aria-expanded", "false");
  }
  return closed;
}

function refDatasetControl(
  field: DatasetField,
  index: number,
  options: SchemaFormOptions,
  depth: number,
  subIndex?: number,
): string {
  const datasets = (options.datasetOptions ?? []).filter((d) => d.id !== options.excludeDatasetId);
  const selected = field.dataset ?? "";
  const opts = [
    `<option value="">— choose dataset —</option>`,
    ...datasets.map((d) => {
      const label = d.title.trim() || d.id;
      return `<option value="${escapeHtml(d.id)}"${d.id === selected ? " selected" : ""}>${escapeHtml(label)} (${escapeHtml(d.id)})</option>`;
    }),
  ].join("");
  const sub = subIndex === undefined ? "" : ` data-schema-sub="${subIndex}"`;
  return `<p><label>Dataset <select class="w3-select" data-schema-dataset="${index}" data-depth="${depth}"${sub}>${opts}</select></label></p>`;
}

function actions(index: number): string {
  return `<span class="editor-type-actions">
    ${schemaIcon("up", index)}
    ${schemaIcon("down", index)}
    ${schemaIcon("remove", index)}
  </span>`;
}

function subActions(parentIndex: number, subIndex: number): string {
  return `<span class="editor-type-actions">
    ${subIcon("up", parentIndex, subIndex)}
    ${subIcon("down", parentIndex, subIndex)}
    ${subIcon("remove", parentIndex, subIndex)}
  </span>`;
}

function subIcon(action: "up" | "down" | "remove", parentIndex: number, subIndex: number): string {
  const labels = { up: "Up", down: "Down", remove: "Remove" } as const;
  const icons = { up: REORDER_ICONS.up, down: REORDER_ICONS.down, remove: REORDER_ICONS.remove } as const;
  return iconButton({
    className: "editor-type-icon",
    label: labels[action],
    actionAttribute: "data-schema-sub-action",
    action,
    indexAttribute: "data-schema-sub",
    index: subIndex,
    icon: icons[action],
    extraAttributes: ` data-schema-parent="${parentIndex}"`,
  });
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

export function readViewColumnsFromSchemaForm(root: HTMLElement, draft: SchemaDraft): string[] {
  const available = availableViewColumns(draft.fields);
  const chosen = new Set<string>();
  for (const { id } of SYSTEM_VIEW_COLUMNS) {
    const input = root.querySelector<HTMLInputElement>(`[data-view-col="${id}"]`);
    if (input?.checked) chosen.add(id);
  }
  const list = root.querySelector(".editor-dataset-schema-custom-fields");
  const rows = [...(list?.querySelectorAll<HTMLElement>(":scope > li[data-schema-index]") ?? [])];
  for (const row of rows) {
    const index = Number(row.dataset.schemaIndex);
    const idEl = row.querySelector<HTMLInputElement>(`[data-schema-id="${index}"][data-depth="0"]`);
    const id = idEl?.value.trim() || draft.fields[index]?.id || "";
    if (!id) continue;
    const vis = row.querySelector<HTMLInputElement>(`[data-schema-visible="${index}"][data-depth="0"]`);
    if (vis?.checked) chosen.add(id);
  }
  return available.filter((id) => chosen.has(id));
}

export function readSchemaForm(root: HTMLElement, draft: SchemaDraft): SchemaDraft {
  const list = root.querySelector(".editor-dataset-schema-custom-fields");
  const rows = [...(list?.querySelectorAll<HTMLElement>(":scope > li[data-schema-index]") ?? [])];
  const claimed: DatasetField[] = [];
  const takeKey = (preferred: string | undefined): string => claimFieldKey(preferred, claimed);
  const fields: DatasetField[] = [];
  for (const row of rows) {
    const index = Number(row.dataset.schemaIndex);
    const base =
      draft.fields[index] ?? {
        key: "",
        id: "",
        label: "",
        kind: "string" as DatasetFieldKind,
      };
    const line = row.querySelector<HTMLElement>(":scope > .editor-type-line") ?? row;
    const kindEl = line.querySelector<HTMLSelectElement>(`[data-schema-kind="${index}"][data-depth="0"]`);
    const kindFromDom = (kindEl?.value.trim() || "") as DatasetFieldKind | "";
    const resolvedKind = (kindFromDom || base.kind || "string") as DatasetFieldKind;
    const field: DatasetField = {
      ...base,
      key: takeKey(row.querySelector<HTMLInputElement>(":scope > [data-schema-key]")?.value || base.key),
      id: line.querySelector<HTMLInputElement>(`[data-schema-id="${index}"][data-depth="0"]`)?.value.trim() ?? "",
      label: line.querySelector<HTMLInputElement>(`[data-schema-label="${index}"][data-depth="0"]`)?.value.trim() ?? "",
      kind: resolvedKind,
      required: line.querySelector<HTMLInputElement>(`[data-schema-required="${index}"][data-depth="0"]`)?.checked === true,
    };
    field.many = line.querySelector<HTMLInputElement>(`[data-schema-many="${index}"][data-depth="0"]`)?.checked === true;
    if (field.kind === "ref") {
      const picked = row
        .querySelector<HTMLSelectElement>(`:scope > p [data-schema-dataset="${index}"][data-depth="0"]`)
        ?.value.trim();
      field.dataset = picked || base.dataset;
    } else {
      delete field.dataset;
    }
    if (field.kind === "object") {
      field.fields = readObjectSubfields(row, base.fields ?? [], takeKey);
    } else {
      delete field.fields;
    }
    if (field.kind === "enum") {
      const text = row.querySelector<HTMLTextAreaElement>(`:scope > .editor-schema-enum [data-schema-enum="${index}"][data-depth="0"]`)?.value ?? "";
      field.options = parseEnumOptions(text);
    } else {
      delete field.options;
    }
    fields.push(field);
  }
  const viewColumns = readViewColumnsFromSchemaForm(root, { fields, viewColumns: draft.viewColumns });
  return { fields, viewColumns };
}

/** Keep the preferred key when it is free. Otherwise mint one that is unused in `claimed`. */
function claimFieldKey(preferred: string | undefined, claimed: DatasetField[]): string {
  const key = preferred?.trim() ?? "";
  if (key && !claimed.some((field) => field.key === key)) {
    claimed.push({ key, id: "taken", label: "", kind: "string" });
    return key;
  }
  const next = newFieldKey(claimed);
  claimed.push({ key: next, id: "taken", label: "", kind: "string" });
  return next;
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
  if (action === "add-object-sub") {
    const parent = list[index];
    if (!parent || parent.kind !== "object") return list;
    const subs = [...(parent.fields ?? [])];
    subs.push({ key: newFieldKey(list), id: "", label: "", kind: "string" });
    list[index] = { ...parent, fields: subs };
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

/** After a kind change, focus the control that kind just revealed. */
export function focusSchemaKindEditor(
  root: HTMLElement,
  index: number,
  subIndex: number | undefined,
  kind: string,
): void {
  queueMicrotask(() => {
    const focus = (selector: string) => {
      root.querySelector<HTMLElement>(selector)?.focus();
    };
    if (kind === "enum") {
      focus(
        subIndex === undefined
          ? `[data-schema-enum="${index}"][data-depth="0"]`
          : `[data-schema-enum="${index}"][data-schema-sub="${subIndex}"]`,
      );
      return;
    }
    if (kind === "ref") {
      focus(
        subIndex === undefined
          ? `[data-schema-dataset="${index}"][data-depth="0"]`
          : `[data-schema-dataset="${index}"][data-schema-sub="${subIndex}"]`,
      );
      return;
    }
    if (kind === "object" && subIndex === undefined) {
      const subs = root.querySelectorAll<HTMLInputElement>(`[data-schema-sub-id="${index}"]`);
      const target = subs[subs.length - 1];
      if (target) {
        target.focus();
        target.select();
        return;
      }
    }
    focus(
      subIndex === undefined
        ? `[data-schema-kind="${index}"][data-depth="0"]`
        : `[data-schema-sub-kind="${index}"][data-schema-sub="${subIndex}"]`,
    );
  });
}

export function applySchemaAction(draft: SchemaDraft, action: string, index: number): SchemaDraft {
  const fields = mutateFieldList(draft.fields, action, index);
  if (action === "remove") {
    const removedId = draft.fields[index]?.id.trim();
    const viewColumns = removedId ? draft.viewColumns.filter((id) => id !== removedId) : draft.viewColumns;
    return { fields, viewColumns };
  }
  return { fields, viewColumns: draft.viewColumns };
}

export function applySchemaActionForRow(draft: SchemaDraft, row: HTMLElement, action: string): SchemaDraft {
  const index = schemaRowPath(row)[0] ?? 0;
  return applySchemaAction(draft, action, index);
}

export function applySchemaSubAction(
  draft: SchemaDraft,
  action: string,
  parentIndex: number,
  subIndex: number,
): SchemaDraft {
  const fields = draft.fields.map((field, index) => {
    if (index !== parentIndex || field.kind !== "object") return field;
    const subs = [...(field.fields ?? [])];
    if (action === "remove") return { ...field, fields: subs.filter((_, i) => i !== subIndex) };
    if (action === "up" && subIndex > 0) {
      [subs[subIndex - 1], subs[subIndex]] = [subs[subIndex]!, subs[subIndex - 1]!];
    } else if (action === "down" && subIndex < subs.length - 1) {
      [subs[subIndex + 1], subs[subIndex]] = [subs[subIndex]!, subs[subIndex + 1]!];
    }
    return { ...field, fields: subs };
  });
  return { fields, viewColumns: draft.viewColumns };
}

function readObjectSubfields(
  row: HTMLElement,
  fallback: DatasetField[],
  takeKey: (preferred: string | undefined) => string,
): DatasetField[] {
  const host = row.querySelector(":scope > .editor-dataset-object-schema");
  const items = [...(host?.querySelectorAll<HTMLElement>(":scope > ul > li[data-schema-sub-index]") ?? [])];
  return items.map((item) => {
    const subIndex = Number(item.dataset.schemaSubIndex);
    const base = fallback[subIndex] ?? { key: "", id: "", label: "", kind: "string" as DatasetFieldKind };
    const kind = (item.querySelector<HTMLSelectElement>("[data-schema-sub-kind]")?.value || "string") as DatasetFieldKind;
    const field: DatasetField = {
      key: takeKey(item.querySelector<HTMLInputElement>("[data-schema-sub-key]")?.value || base.key),
      id: item.querySelector<HTMLInputElement>("[data-schema-sub-id]")?.value.trim() ?? "",
      label: item.querySelector<HTMLInputElement>("[data-schema-sub-label]")?.value.trim() ?? "",
      kind,
    };
    if (base.required) field.required = true;
    if (base.many) field.many = true;
    if (base.default !== undefined) field.default = base.default;
    if (field.kind === "ref") {
      const picked = item.querySelector<HTMLSelectElement>("[data-schema-dataset]")?.value.trim() ?? "";
      field.dataset = picked || base.dataset;
    }
    if (field.kind === "enum") {
      field.options = parseEnumOptions(item.querySelector<HTMLTextAreaElement>("[data-schema-enum]")?.value ?? "");
    }
    return field;
  });
}

function parseEnumOptions(text: string): { value: string; label: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, label] = line.split("|");
      return { value: (value ?? "").trim(), label: (label ?? value ?? "").trim() };
    })
    .filter((o) => o.value);
}

export function validateSchemaDraft(fields: DatasetField[]): string | undefined {
  const ids = new Set<string>();
  const keys = new Set<string>();
  const visit = (list: readonly DatasetField[], depth: number): string | undefined => {
    for (const field of list) {
      const id = field.id.trim();
      if (!id) return "Each field needs an id.";
      if ((DATASET_RESERVED_FIELD_IDS as readonly string[]).includes(id)) return `Field id ${id} is reserved.`;
      if (!DATASET_RECORD_ID.test(id)) return `Field id ${id} is invalid.`;
      if (ids.has(id)) return `Field id ${id} is listed twice.`;
      ids.add(id);
      const key = field.key.trim();
      if (!key) return "Each field needs a key.";
      if (keys.has(key)) return `Field key ${key} is listed twice.`;
      keys.add(key);
      if (field.kind === "ref" && !field.dataset?.trim()) {
        return `Ref field "${id}" needs a target dataset.`;
      }
      if (field.kind === "enum" && !(field.options ?? []).some((option) => option.value.trim())) {
        return `Enum field "${id}" needs at least one option.`;
      }
      if (field.kind === "object") {
        if (depth > 0) return "Object fields cannot nest another object.";
        if (!(field.fields ?? []).length) return `Object field "${id}" needs at least one subfield.`;
        const nested = visit(field.fields ?? [], depth + 1);
        if (nested) return nested;
      }
    }
    return undefined;
  };
  return visit(fields, 0);
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
