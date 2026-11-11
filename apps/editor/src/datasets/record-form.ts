import type { DatasetField, DatasetRootRecord } from "@r-a-i-t-h/tessera-model";
import { escapeHtml, fieldId } from "../dom.js";
import { REORDER_ICONS } from "../editor-icons.js";
import {
  editingToolbar,
  htmlForEditing,
  htmlFromEditing,
  inlineTools,
  listTools,
} from "../compose/rich-text-field.js";
import { rawHtmlField } from "../raw-html-field.js";

export type RecordFormOptions = {
  isRoot?: boolean;
  formatAssetDisplay?: (assetId: string) => string;
  /** Disambiguates control ids when one field is repeated in a collection. */
  idSuffix?: string;
  hideLabel?: boolean;
};

export function renderRecordForm(
  record: Record<string, unknown>,
  fields: readonly DatasetField[],
  options: RecordFormOptions = {},
): string {
  const isRoot = options.isRoot ?? false;
  const system = isRoot ? renderRootSystem(record, fields) : "";
  return `${system}${fields.map((f) => renderField(record, f, options)).join("")}`;
}

function renderRootSystem(record: Record<string, unknown>, _fields: readonly DatasetField[]): string {
  const page = typeof record.page === "string" ? record.page : "";
  return `<div class="editor-props">
        <p><label>uid</label><span class="editor-prop-control">${escapeHtml(String(record.uid ?? ""))}</span></p>
        <p><label for="dataset-record-page">page</label><span class="editor-prop-control"><input id="dataset-record-page" name="page" data-record-page class="w3-input w3-border" value="${escapeHtml(page)}" placeholder="Page id when this record belongs to one page only" /></span></p>
        <p><label>added</label><span class="editor-prop-control w3-text-grey">${escapeHtml(String(record.added ?? ""))}</span></p>
        <p><label>modified</label><span class="editor-prop-control w3-text-grey">${escapeHtml(String(record.modified ?? ""))}</span></p>
      </div>`;
}

function renderField(record: Record<string, unknown>, field: DatasetField, options: RecordFormOptions): string {
  const name = field.id;
  const id = fieldId(`${name}${options.idSuffix ?? ""}`);
  const value = record[field.id];
  const label = escapeHtml(field.label || field.id);
  const aria = options.hideLabel ? ` aria-label="${label}"` : "";
  const labelFor = options.hideLabel ? "" : `<label for="${id}">${label}</label>`;
  if (field.kind === "object") {
    return renderObjectField(name, label, field, value, options);
  }
  if (field.many && field.kind !== "asset" && field.kind !== "ref") {
    return renderScalarCollection(name, label, field, value, options);
  }
  if (field.kind === "boolean") {
    const checked = value === true;
    const caption = options.hideLabel ? "" : ` ${label}`;
    return `<p class="editor-check"><label><input id="${id}" name="${escapeHtml(name)}" type="checkbox" data-kind="boolean"${checked ? " checked" : ""}${aria} />${caption}</label></p>`;
  }
  if (field.kind === "enum") {
    const blank =
      field.required
        ? ""
        : `<option value=""${value === undefined || value === null || value === "" ? " selected" : ""}>—</option>`;
    const opts =
      blank +
      (field.options ?? [])
        .map((o) => `<option value="${escapeHtml(o.value)}"${value === o.value ? " selected" : ""}>${escapeHtml(o.label)}</option>`)
        .join("");
    return `<p>${labelFor}<span class="editor-prop-control"><select id="${id}" name="${escapeHtml(name)}" class="w3-select w3-border"${aria}>${opts}</select></span></p>`;
  }
  if (field.kind === "html") {
    return rawHtmlField(name, options.hideLabel ? "" : field.label || field.id, String(value ?? ""), 10, "", options.idSuffix ?? "");
  }
  if (field.kind === "text") {
    const body = htmlForEditing(String(value ?? ""));
    const textLabel = options.hideLabel ? "" : `<label>${label}</label>`;
    return `<motion class="editor-dataset-rich editor-prop-wide">${textLabel}
      ${editingToolbar(inlineTools(), listTools())}
      <div class="editor-text-body tessera-text w3-border" contenteditable="true" data-dataset-text="${escapeHtml(name)}" data-field="html" data-blocks="true" data-placeholder="Write…"${aria}>${body}</div>
    </motion>`.replaceAll("motion", "div");
  }
  if (field.kind === "string") {
    return `<p>${labelFor}<span class="editor-prop-control"><input id="${id}" name="${escapeHtml(name)}" type="text" class="w3-input w3-border" value="${escapeHtml(String(value ?? ""))}"${aria} /></span></p>`;
  }
  if (field.kind === "asset" || field.kind === "ref") {
    const rawId =
      field.kind === "ref"
        ? field.many && Array.isArray(value)
          ? value.join(", ")
          : String(value ?? "")
        : field.many && Array.isArray(value)
          ? value.join(", ")
          : String(value ?? "");
    const display =
      field.kind === "asset" && !field.many && rawId && options.formatAssetDisplay
        ? options.formatAssetDisplay(rawId)
        : escapeHtml(rawId || "None");
    return `<p data-picker-field="${escapeHtml(name)}" data-picker-kind="${field.kind}"${field.kind === "ref" ? ` data-ref-dataset="${escapeHtml(field.dataset ?? "")}"` : ""}${field.many ? ' data-field-many="true"' : ""}>
      <label>${label}</label>
      <span class="editor-prop-control"><span data-picker-display>${display}</span>
      <button type="button" class="w3-button w3-tiny w3-white" data-picker-choose="${escapeHtml(name)}">Choose</button>
      <button type="button" class="w3-button w3-tiny w3-white" data-picker-clear="${escapeHtml(name)}">Clear</button>
      <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(field.many && Array.isArray(value) ? JSON.stringify(value) : String(value ?? ""))}" />
      </span></p>`;
  }
  const inputType = field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text";
  return `<p>${labelFor}<span class="editor-prop-control"><input id="${id}" name="${escapeHtml(name)}" type="${inputType}" class="w3-input w3-border" value="${escapeHtml(value === undefined || value === null ? "" : String(value))}"${aria} /></span></p>`;
}

function renderScalarCollection(
  name: string,
  label: string,
  field: DatasetField,
  value: unknown,
  options: RecordFormOptions,
): string {
  const single: DatasetField = { ...field, many: false };
  const blocks = collectionItems(value)
    .map((item, index) => {
      const control = renderField({ [field.id]: item }, single, {
        formatAssetDisplay: options.formatAssetDisplay,
        idSuffix: `${options.idSuffix ?? ""}-${index}`,
        hideLabel: true,
      });
      return `<div class="editor-dataset-many-row" data-many-field="${escapeHtml(name)}" data-many-index="${index}">
        ${control}
        ${collectionRemoveButton("data-many-remove", name)}
      </div>`;
    })
    .join("");
  return `<div class="editor-dataset-many" data-many-parent="${escapeHtml(name)}">
    <p class="editor-dataset-many-label">${label}</p>
    ${blocks}
    <p><button type="button" class="w3-button w3-tiny w3-white w3-border" data-many-add="${escapeHtml(name)}">Add ${label}</button></p>
  </div>`;
}

function collectionRemoveButton(attribute: "data-many-remove" | "data-object-remove", fieldName: string): string {
  return `<button type="button" class="editor-type-icon" aria-label="Remove" title="Remove" ${attribute}="${escapeHtml(fieldName)}">${REORDER_ICONS.remove}</button>`;
}

function collectionItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function renderObjectField(
  name: string,
  label: string,
  field: DatasetField,
  value: unknown,
  options: RecordFormOptions,
): string {
  const nested: RecordFormOptions = { isRoot: false, formatAssetDisplay: options.formatAssetDisplay };
  const subfields = field.fields ?? [];
  const items = objectItems(field, value);
  const blocks = items
    .map((item, index) => {
      const obj = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
      const inner = renderRecordForm(obj, subfields, nested);
      const remove = field.many ? collectionRemoveButton("data-object-remove", name) : "";
      return `<fieldset class="editor-fieldset editor-dataset-object-row" data-object-field="${escapeHtml(name)}" data-object-index="${index}">
        <legend><span>${label}${field.many ? ` ${index + 1}` : ""}</span>${remove}</legend>
        ${inner}
      </fieldset>`;
    })
    .join("");
  const addBtn = field.many
    ? `<p><button type="button" class="w3-button w3-tiny w3-white w3-border" data-object-add="${escapeHtml(name)}">Add ${label}</button></p>`
    : "";
  return `<motion-capture class="editor-dataset-object" data-object-parent="${escapeHtml(name)}">${blocks}${addBtn}</motion-capture>`.replace(
    "<motion-capture",
    "<div",
  ).replace("</motion-capture>", "</div>");
}

function objectItems(field: DatasetField, value: unknown): unknown[] {
  if (field.many) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return [value];
    return [];
  }
  if (value && typeof value === "object" && !Array.isArray(value)) return [value];
  return [{}];
}

/** Read the open record form, then add or remove one row of a collection field. */
export function commitObjectListChange(
  form: HTMLFormElement,
  fields: readonly DatasetField[],
  draft: Record<string, unknown>,
  change: { op: "add"; fieldId: string } | { op: "remove"; fieldId: string; index: number },
): boolean {
  const field = fields.find((item) => item.id === change.fieldId);
  if (!field?.many || field.kind === "asset" || field.kind === "ref") return false;
  const next = readRecordForm(form, fields, draft);
  for (const key of Object.keys(draft)) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) delete draft[key];
  }
  Object.assign(draft, next);
  const current = draft[field.id];
  const list = Array.isArray(current)
    ? [...current]
    : current === undefined || current === null || current === ""
      ? []
      : [current];
  if (change.op === "add") {
    list.push(field.kind === "object" ? {} : field.kind === "boolean" ? false : "");
  } else if (change.index >= 0 && change.index < list.length) {
    list.splice(change.index, 1);
  } else {
    return false;
  }
  if (list.length) draft[field.id] = list;
  else delete draft[field.id];
  return true;
}

function isBlankItem(field: DatasetField, value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (field.kind === "boolean") return false;
  if (field.many && Array.isArray(value)) return value.every((item) => isBlankItem({ ...field, many: false }, item));
  if (field.kind === "object" && value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return (field.fields ?? []).every((sub) => isBlankItem(sub, obj[sub.id]));
  }
  return false;
}

/** Drop blank collection rows so an untouched sub-form is not stored. */
export function compactRecordCollections(
  record: Record<string, unknown>,
  fields: readonly DatasetField[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...record };
  for (const field of fields) {
    const value = out[field.id];
    if (field.kind === "object" && value && typeof value === "object" && !Array.isArray(value)) {
      const nested = compactRecordCollections(value as Record<string, unknown>, field.fields ?? []);
      if (isBlankItem(field, nested)) delete out[field.id];
      else out[field.id] = nested;
    }
    if (!field.many || !Array.isArray(value)) continue;
    const list = value
      .map((item) =>
        field.kind === "object" && item && typeof item === "object" && !Array.isArray(item)
          ? compactRecordCollections(item as Record<string, unknown>, field.fields ?? [])
          : item,
      )
      .filter((item) => !isBlankItem(field, item));
    if (list.length) out[field.id] = list;
    else delete out[field.id];
  }
  return out;
}

export function readRecordForm(form: HTMLFormElement, fields: readonly DatasetField[], base: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  const pageEl = form.querySelector<HTMLInputElement>("[data-record-page]");
  if (pageEl instanceof HTMLInputElement) {
    const page = pageEl.value.trim();
    if (page) out.page = page;
    else delete out.page;
  }
  for (const field of fields) readFieldFromForm(form, field, out);
  return out;
}

function controlInRoot(
  root: HTMLFormElement | HTMLElement,
  name: string,
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  if (root instanceof HTMLFormElement) {
    const el = root.elements.namedItem(name);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      return el;
    }
    return null;
  }
  const el = root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    `[name="${CSS.escape(name)}"]`,
  );
  return el ?? null;
}

function readFieldFromForm(
  form: HTMLFormElement | HTMLElement,
  field: DatasetField,
  target: Record<string, unknown>,
): void {
  if (field.kind === "object") {
    const rows = [...form.querySelectorAll<HTMLElement>(`[data-object-field="${CSS.escape(field.id)}"]`)];
    const subfields = field.fields ?? [];
    const values = rows.map((row) => {
      const obj: Record<string, unknown> = {};
      for (const sub of subfields) readFieldFromForm(row, sub, obj);
      return obj;
    });
    if (!values.length) {
      delete target[field.id];
      return;
    }
    if (field.many) target[field.id] = values;
    else target[field.id] = values[0];
    return;
  }
  if (field.many && field.kind !== "asset" && field.kind !== "ref") {
    const rows = [...form.querySelectorAll<HTMLElement>(`[data-many-field="${CSS.escape(field.id)}"]`)];
    const values: unknown[] = [];
    if (field.kind === "boolean") {
      for (const row of rows) {
        const box = row.querySelector<HTMLInputElement>('input[type="checkbox"]');
        values.push(box?.checked === true);
      }
    } else {
      const single: DatasetField = { ...field, many: false };
      for (const row of rows) {
        const obj: Record<string, unknown> = {};
        readFieldFromForm(row, single, obj);
        values.push(obj[field.id] !== undefined ? obj[field.id] : "");
      }
    }
    if (values.length) target[field.id] = values;
    else delete target[field.id];
    return;
  }
  if (field.kind === "text") {
    const el = form.querySelector<HTMLElement>(`[data-dataset-text="${CSS.escape(field.id)}"]`);
    if (el) {
      const html = htmlFromEditing(el.innerHTML, true);
      if (html) target[field.id] = html;
      else delete target[field.id];
    }
    return;
  }
  const name = field.id;
  const el = controlInRoot(form, name);
  if (field.kind === "boolean") {
    if (el instanceof HTMLInputElement && el.type === "checkbox" && el.checked) target[field.id] = true;
    else delete target[field.id];
    return;
  }
  if (field.kind === "asset" || field.kind === "ref") {
    const hidden = form.querySelector<HTMLInputElement>(
      `input[type="hidden"][name="${CSS.escape(name)}"]`,
    );
    const raw = hidden?.value ?? "";
    if (!raw) {
      delete target[field.id];
      return;
    }
    if (field.kind === "ref") {
      if (field.many) {
        target[field.id] = raw
          .split(/[,\s]+/)
          .map((part) => Number(part))
          .filter((n) => Number.isInteger(n) && n > 0);
      } else target[field.id] = Number(raw);
    } else if (field.many) {
      try {
        target[field.id] = JSON.parse(raw) as string[];
      } catch {
        target[field.id] = raw.split(/,\s*/).filter(Boolean);
      }
    } else target[field.id] = raw;
    return;
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    const text = el.value.trim();
    if (!text && !field.required) {
      delete target[field.id];
      return;
    }
    if (field.kind === "number") target[field.id] = Number(text);
    else target[field.id] = text;
  }
}
