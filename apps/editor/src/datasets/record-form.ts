import type { DatasetField, DatasetRootRecord } from "@r-a-i-t-h/tessera-model";
import { emptyListItemDraft } from "@r-a-i-t-h/tessera-model";
import { escapeHtml, fieldId } from "../dom.js";
import { readHtmlEditor, renderHtmlEditor } from "../html-editor.js";

export function renderRecordForm(
  record: Record<string, unknown>,
  fields: readonly DatasetField[],
  options: { isRoot?: boolean; path?: string },
): string {
  const isRoot = options.isRoot ?? false;
  const system = isRoot ? renderRootSystem(record, fields) : "";
  return `${system}${fields.map((f) => renderField(record, f, options.path ?? "")).join("")}`;
}

function renderRootSystem(record: Record<string, unknown>, _fields: readonly DatasetField[]): string {
  return `<div class="editor-props">
        <p><label>uid</label><span class="editor-prop-control">${escapeHtml(String(record.uid ?? ""))}</span></p>
        <p><label>added</label><span class="editor-prop-control w3-text-grey">${escapeHtml(String(record.added ?? ""))}</span></p>
        <p><label>modified</label><span class="editor-prop-control w3-text-grey">${escapeHtml(String(record.modified ?? ""))}</span></p>
      </div>`;
}

function renderField(record: Record<string, unknown>, field: DatasetField, path: string): string {
  const name = path ? `${path}.${field.id}` : field.id;
  const id = fieldId(name);
  const value = record[field.id];
  const label = escapeHtml(field.label || field.id);
  if (field.kind === "object") {
    const obj = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    return `<fieldset class="editor-fieldset"><legend>${label}</legend>${(field.fields ?? [])
      .map((child) => renderField(obj, child, name))
      .join("")}</fieldset>`;
  }
  if (field.kind === "list") {
    const items = Array.isArray(value) ? value : [];
    const rows = items
      .map(
        (item, index) =>
          `<li class="editor-dataset-list-item" data-list-path="${escapeHtml(name)}" data-list-index="${index}">
            ${renderRecordForm(item as Record<string, unknown>, field.fields ?? [], { path: `${name}.${index}` })}
            <p><button type="button" class="w3-button w3-tiny" data-list-remove="${escapeHtml(name)}" data-list-index="${index}">Remove</button></p>
          </li>`,
      )
      .join("");
    return `<fieldset class="editor-fieldset" data-list-field="${escapeHtml(name)}"><legend>${label}</legend>
      <ul class="w3-ul">${rows}</ul>
      <p><button type="button" class="w3-button w3-tiny" data-list-add="${escapeHtml(name)}">Add row</button></p>
    </fieldset>`;
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
    return `<div class="editor-prop-wide" data-html-field="${escapeHtml(name)}"><p><label>${label}</label></p>${renderHtmlEditor(String(value ?? ""), id)}</div>`;
  }
  if (field.kind === "text") {
    return `<p class="editor-prop-wide"><label for="${id}">${label}</label><span class="editor-prop-control"><textarea id="${id}" name="${escapeHtml(name)}" class="w3-input w3-border" rows="4">${escapeHtml(String(value ?? ""))}</textarea></span></p>`;
  }
  if (field.kind === "asset" || field.kind === "ref") {
    const display =
      field.kind === "ref"
        ? String(value ?? "")
        : field.many && Array.isArray(value)
          ? value.join(", ")
          : String(value ?? "");
    return `<p data-picker-field="${escapeHtml(name)}" data-picker-kind="${field.kind}"${field.kind === "ref" ? ` data-ref-dataset="${escapeHtml(field.dataset ?? "")}"` : ""}${field.many ? " data-asset-many=\"true\"" : ""}>
      <label>${label}</label>
      <span class="editor-prop-control"><span data-picker-display>${escapeHtml(display || "None")}</span>
      <button type="button" class="w3-button w3-tiny w3-white" data-picker-choose="${escapeHtml(name)}">Choose</button>
      <button type="button" class="w3-button w3-tiny w3-white" data-picker-clear="${escapeHtml(name)}">Clear</button>
      <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(Array.isArray(value) ? JSON.stringify(value) : String(value ?? ""))}" />
      </span></p>`;
  }
  const inputType = field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text";
  return `<p><label for="${id}">${label}</label><span class="editor-prop-control"><input id="${id}" name="${escapeHtml(name)}" type="${inputType}" class="w3-input w3-border" value="${escapeHtml(value === undefined || value === null ? "" : String(value))}" /></span></p>`;
}

export function readRecordForm(form: HTMLFormElement, fields: readonly DatasetField[], base: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const field of fields) readFieldFromForm(form, field, out, "");
  return out;
}

function readFieldFromForm(
  form: HTMLFormElement,
  field: DatasetField,
  target: Record<string, unknown>,
  path: string,
): void {
  const name = path ? `${path}.${field.id}` : field.id;
  if (field.kind === "object") {
    const obj: Record<string, unknown> = {};
    for (const child of field.fields ?? []) readFieldFromForm(form, child, obj, name);
    if (Object.keys(obj).length) target[field.id] = obj;
    else delete target[field.id];
    return;
  }
  if (field.kind === "list") {
    const items: Record<string, unknown>[] = [];
    const prefix = `${name}.`;
    const indices = new Set<number>();
    for (const el of form.elements) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) continue;
      if (!el.name.startsWith(prefix)) continue;
      const rest = el.name.slice(prefix.length);
      const idx = Number(rest.split(".")[0]);
      if (Number.isInteger(idx)) indices.add(idx);
    }
    for (const index of [...indices].sort((a, b) => a - b)) {
      const item: Record<string, unknown> = {};
      const existing = Array.isArray(target[field.id]) ? (target[field.id] as Record<string, unknown>[])[index] : undefined;
      if (existing) Object.assign(item, existing);
      for (const child of field.fields ?? []) readFieldFromForm(form, child, item, `${name}.${index}`);
      items.push(item);
    }
    if (items.length) target[field.id] = items;
    else delete target[field.id];
    return;
  }
  if (field.kind === "html") {
    const host = form.querySelector<HTMLElement>(`[data-html-field="${CSS.escape(name)}"] [data-html-editor]`);
    if (host) {
      const html = readHtmlEditor(host);
      if (html) target[field.id] = html;
      else delete target[field.id];
    }
    return;
  }
  const el = form.elements.namedItem(name);
  if (field.kind === "boolean") {
    if (el instanceof HTMLInputElement && el.checked) target[field.id] = true;
    else delete target[field.id];
    return;
  }
  if (field.kind === "asset" || field.kind === "ref") {
    const hidden = form.querySelector<HTMLInputElement>(`input[type="hidden"][name="${CSS.escape(name)}"]`);
    const raw = hidden?.value ?? "";
    if (!raw) {
      delete target[field.id];
      return;
    }
    if (field.kind === "ref") target[field.id] = Number(raw);
    else if (field.many) target[field.id] = JSON.parse(raw) as string[];
    else target[field.id] = raw;
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


export function newListItemForField(field: DatasetField): Record<string, unknown> {
  return emptyListItemDraft(field.fields ?? []);
}
