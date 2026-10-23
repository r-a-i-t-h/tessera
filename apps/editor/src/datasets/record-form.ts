import type { DatasetField, DatasetRootRecord } from "@r-a-i-t-h/tessera-model";
import { escapeHtml, fieldId } from "../dom.js";

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
  return `<div class="editor-props">
        <p><label>uid</label><span class="editor-prop-control">${escapeHtml(String(record.uid ?? ""))}</span></p>
        <p><label>added</label><span class="editor-prop-control w3-text-grey">${escapeHtml(String(record.added ?? ""))}</span></p>
        <p><label>modified</label><span class="editor-prop-control w3-text-grey">${escapeHtml(String(record.modified ?? ""))}</span></p>
      </div>`;
}

function renderField(record: Record<string, unknown>, field: DatasetField, options: RecordFormOptions): string {
  const name = field.id;
  const id = fieldId(name);
  const value = record[field.id];
  const label = escapeHtml(field.label || field.id);
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
  if (field.kind === "text") {
    return `<p class="editor-prop-wide"><label for="${id}">${label}</label><span class="editor-prop-control"><textarea id="${id}" name="${escapeHtml(name)}" class="w3-input w3-border" rows="4">${escapeHtml(String(value ?? ""))}</textarea></span></p>`;
  }
  if (field.kind === "asset" || field.kind === "ref") {
    const rawId =
      field.kind === "ref"
        ? String(value ?? "")
        : field.many && Array.isArray(value)
          ? value.join(", ")
          : String(value ?? "");
    const display =
      field.kind === "asset" && !field.many && rawId && options.formatAssetDisplay
        ? options.formatAssetDisplay(rawId)
        : escapeHtml(rawId || "None");
    return `<p data-picker-field="${escapeHtml(name)}" data-picker-kind="${field.kind}"${field.kind === "ref" ? ` data-ref-dataset="${escapeHtml(field.dataset ?? "")}"` : ""}${field.many ? " data-asset-many=\"true\"" : ""}>
      <label>${label}</label>
      <span class="editor-prop-control"><span data-picker-display>${display}</span>
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
  for (const field of fields) readFieldFromForm(form, field, out);
  return out;
}

function readFieldFromForm(form: HTMLFormElement, field: DatasetField, target: Record<string, unknown>): void {
  const name = field.id;
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
