import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { type FieldSchema, type FormSchema } from "./schema.js";

export type SubmittedValue = string | boolean;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fieldId(name: string): string {
  return `f-${name.replace(/[^a-zA-Z0-9]+/g, "-")}`;
}

/** Draw every schema field, including ones with no stored value. */
export function renderForm(schema: FormSchema, values: Record<string, unknown>): string {
  return schema.fields.map((field) => renderField(field, values[field.name])).join("");
}

export function renderField(field: FieldSchema, value: unknown): string {
  const id = fieldId(field.name);
  if (field.type === "Checkbox") {
    const checked = field.defaultChecked ? value !== false : value === true;
    return `<p class="editor-check"><label><input id="${id}" name="${escapeHtml(field.name)}" type="checkbox" data-kind="checkbox"${checked ? " checked" : ""} /> ${escapeHtml(field.label)}</label></p>`;
  }
  if (field.type === "SingleSelect") {
    const options = field.options ?? [];
    const current = typeof value === "string" && options.some((option) => option.value === value)
      ? value
      : (field.defaultValue ?? options[0]?.value ?? "");
    const choices = options
      .map(
        (option) =>
          `<option value="${escapeHtml(option.value)}"${option.value === current ? " selected" : ""}>${escapeHtml(option.label)}</option>`,
      )
      .join("");
    return `<p><label for="${id}">${escapeHtml(field.label)}</label>
    <select id="${id}" name="${escapeHtml(field.name)}" data-kind="select" class="w3-select w3-border w3-margin-top">${choices}</select></p>`;
  }
  if (field.type === "yaml") {
    const text = stringifyYaml(value ?? "", { indent: 2, lineWidth: 0 }).trimEnd();
    return textarea(field, id, text, "yaml");
  }
  const text = displayString(field, value);
  if (field.readOnly) {
    return `<p><label for="${id}">${escapeHtml(field.label)}</label>
    <input id="${id}" class="w3-input w3-border w3-margin-top" value="${escapeHtml(text)}" disabled />
    <input type="hidden" name="${escapeHtml(field.name)}" value="${escapeHtml(text)}" /></p>`;
  }
  if (field.rows && field.rows > 1) return textarea(field, id, text, "text");
  const inputType =
    field.type === "number" ? "number" : field.type === "date" ? "date" : (field.inputType ?? "text");
  const kind = field.list ? "csv" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
  return `<p><label for="${id}">${escapeHtml(field.label)}</label>
    <input id="${id}" name="${escapeHtml(field.name)}" type="${inputType}" data-kind="${kind}" class="w3-input w3-border w3-margin-top" value="${escapeHtml(text)}" /></p>`;
}

function textarea(field: FieldSchema, id: string, text: string, kind: string): string {
  const rows = field.rows ?? 8;
  const yaml = kind === "yaml";
  const extra = yaml ? " editor-yaml" : rows >= 14 ? " editor-body" : "";
  const spell = yaml ? ` spellcheck="false"` : "";
  return `<p><label for="${id}">${escapeHtml(field.label)}</label>
    <textarea id="${id}" name="${escapeHtml(field.name)}" data-kind="${kind}" rows="${rows}"${spell} class="w3-input w3-border w3-margin-top${extra}">${escapeHtml(text)}</textarea></p>`;
}

function displayString(field: FieldSchema, value: unknown): string {
  if (field.list && Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (value === undefined || value === null) return "";
  return String(value);
}

/**
 * Apply submitted controls onto a copy of the record.
 * Empty optional strings are omitted. A default-checked checkbox omits the key when checked.
 */
export function applySubmitted(
  schema: FormSchema,
  original: Record<string, unknown>,
  submitted: Record<string, SubmittedValue>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...original };
  for (const field of schema.fields) {
    if (field.readOnly) continue;
    if (!(field.name in submitted)) continue;
    applyField(next, field, submitted[field.name]);
  }
  return next;
}

function applyField(target: Record<string, unknown>, field: FieldSchema, raw: SubmittedValue | undefined): void {
  if (field.type === "Checkbox") {
    const checked = raw === true;
    if (field.defaultChecked) {
      if (checked) delete target[field.name];
      else target[field.name] = false;
      return;
    }
    target[field.name] = checked;
    return;
  }
  const text = typeof raw === "string" ? raw : "";
  if (field.type === "SingleSelect") {
    if (!text && !field.required) delete target[field.name];
    else target[field.name] = text || field.defaultValue || "";
    return;
  }
  if (field.type === "number") {
    if (!text.trim()) {
      if (!field.required) delete target[field.name];
      return;
    }
    const parsed = Number(text);
    target[field.name] = Number.isFinite(parsed) ? parsed : text;
    return;
  }
  if (field.type === "yaml") {
    if (!text.trim()) {
      if (!field.required) delete target[field.name];
      return;
    }
    target[field.name] = parseYaml(text);
    return;
  }
  if (field.list) {
    const items = text
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!items.length && !field.required) delete target[field.name];
    else target[field.name] = items;
    return;
  }
  if (!text.trim() && !field.required) {
    delete target[field.name];
    return;
  }
  target[field.name] = text;
}

export function readFormValues(form: HTMLFormElement, schema: FormSchema | undefined, original: unknown): unknown {
  if (!schema || Array.isArray(original) || !original || typeof original !== "object") {
    const yaml = String(new FormData(form).get("_yaml") ?? "");
    return parseYaml(yaml);
  }
  const record = original as Record<string, unknown>;
  const known = new Set(schema.fields.map((field) => field.name));
  const submitted: Record<string, SubmittedValue> = {};
  const extras: { name: string; value: unknown }[] = [];
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
      continue;
    }
    if (!el.name || el.disabled) continue;
    if (known.has(el.name) && !el.name.includes(".")) {
      submitted[el.name] = el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked : el.value;
      continue;
    }
    extras.push({ name: el.name, value: parseControl(el) });
  }
  const next = applySubmitted(schema, record, submitted);
  for (const extra of extras) setPath(next, extra.name, extra.value);
  return next;
}

function parseControl(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): unknown {
  if (el instanceof HTMLInputElement && el.type === "checkbox") return el.checked;
  const kind = el.dataset.kind ?? "text";
  const value = el.value;
  if (kind === "csv") {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (kind === "yaml") return parseYaml(value);
  if (kind === "number") {
    if (!value.trim()) return "";
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const child = cursor[key];
    if (!child || typeof child !== "object" || Array.isArray(child)) cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}
