import type { DatasetField, DatasetRootRecord } from "@r-a-i-t-h/tessera-model";
import { escapeHtml, fieldId } from "../dom.js";
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
  const id = fieldId(name);
  const value = record[field.id];
  const label = escapeHtml(field.label || field.id);
  if (field.kind === "object") {
    return renderObjectField(name, label, field, value, options);
  }
  if (field.kind === "boolean") {
    const checked = value === true;
    return `<p class="editor-check"><label><input id="${id}" name="${escapeHtml(name)}" type="checkbox" data-kind="boolean"${checked ? " checked" : ""} /> ${label}</label></p>`;
  }
  if (field.kind === "enum") {
    const opts = (field.options ?? [])
      .map((o) => `<option value="${escapeHtml(o.value)}"${value === o.value ? " selected" : ""}>${escapeHtml(o.label)}</option>`)
      .join("");
    return `<p><label for="${id}">${label}</label><span class="editor-prop-control"><select id="${id}" name="${escapeHtml(name)}" class="w3-select w3-border">${opts}</select></span></p>`;
  }
  if (field.kind === "html") {
    return rawHtmlField(name, field.label || field.id, String(value ?? ""), 10);
  }
  if (field.kind === "text") {
    const body = htmlForEditing(String(value ?? ""));
    return `<motion class="editor-dataset-rich editor-prop-wide"><label>${label}</label>
      ${editingToolbar(inlineTools(), listTools())}
      <div class="editor-text-body tessera-text w3-border" contenteditable="true" data-dataset-text="${escapeHtml(name)}" data-field="html" data-blocks="true" data-placeholder="Write…">${body}</div>
    </motion>`.replaceAll("motion", "div");
  }
  if (field.kind === "string") {
    return `<p><label for="${id}">${label}</label><span class="editor-prop-control"><input id="${id}" name="${escapeHtml(name)}" type="text" class="w3-input w3-border" value="${escapeHtml(String(value ?? ""))}" /></span></p>`;
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
  return `<p><label for="${id}">${label}</label><span class="editor-prop-control"><input id="${id}" name="${escapeHtml(name)}" type="${inputType}" class="w3-input w3-border" value="${escapeHtml(value === undefined || value === null ? "" : String(value))}" /></span></p>`;
}

function renderObjectField(
  name: string,
  label: string,
  field: DatasetField,
  value: unknown,
  options: RecordFormOptions,
): string {
  const nested: RecordFormOptions = { ...options, isRoot: false };
  const subfields = field.fields ?? [];
  const items = field.many ? (Array.isArray(value) ? value : []) : value && typeof value === "object" ? [value] : [{}];
  const blocks = items
    .map((item, index) => {
      const obj = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
      const inner = renderRecordForm(obj, subfields, nested);
      return `<fieldset class="editor-fieldset editor-dataset-object-row" data-object-field="${escapeHtml(name)}" data-object-index="${index}">
        <legend>${label}${field.many ? ` ${index + 1}` : ""}</legend>
        ${inner}
      </fieldset>`;
    })
    .join("");
  const addBtn = field.many
    ? `<p><button type="button" class="w3-button w3-tiny w3-white w3-border" data-object-add="${escapeHtml(name)}">Add ${escapeHtml(label)}</button></p>`
    : "";
  return `<motion-capture class="editor-dataset-object" data-object-parent="${escapeHtml(name)}">${blocks || renderRecordForm({}, subfields, nested)}${addBtn}</motion-capture>`.replace(
    "<motion-capture",
    "<div",
  ).replace("</motion-capture>", "</div>");
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
