import { escapeHtml } from "../dom.js";
import type { ControlValue } from "./nav.js";

export type LayoutChoice = { id: string };

export type TypeFieldRow = {
  id: string;
  required: boolean;
  extra: Record<string, unknown>;
};

export type TypeDraft = {
  id: string;
  layoutId: string;
  fields: TypeFieldRow[];
  extra: Record<string, unknown>;
};

export type TypeAction = "add-field" | "remove" | "up" | "down";

const TYPE_ACTIONS: readonly TypeAction[] = ["add-field", "remove", "up", "down"];

const FIELD_NAME = /^type-field-(\d+)-(.+)$/;

export function isTypeAction(value: string): value is TypeAction {
  return (TYPE_ACTIONS as readonly string[]).includes(value);
}

export function newTypeBody(id: string): { id: string; fields: [] } {
  return { id: id.trim(), fields: [] };
}

export function typeDraft(data: unknown): TypeDraft {
  const record = isRecord(data) ? data : {};
  const extra = { ...record };
  delete extra.id;
  delete extra.layoutId;
  delete extra.fields;
  const fields = Array.isArray(record.fields) ? record.fields.filter(isRecord).map(fieldRow) : [];
  return {
    id: typeof record.id === "string" ? record.id : "",
    layoutId: typeof record.layoutId === "string" ? record.layoutId : "",
    fields,
    extra,
  };
}

export function typeRecord(id: string, draft: TypeDraft): Record<string, unknown> {
  const out: Record<string, unknown> = { ...draft.extra, id };
  const layoutId = draft.layoutId.trim();
  if (layoutId) out.layoutId = layoutId;
  else delete out.layoutId;
  out.fields = draft.fields.map(serializeField);
  return out;
}

export function applyTypeAction(draft: TypeDraft, action: TypeAction, index = 0): TypeDraft {
  if (action === "add-field") return { ...draft, fields: [...draft.fields, newField()] };
  if (action === "remove") return { ...draft, fields: draft.fields.filter((_, i) => i !== index) };
  if (action === "up") return { ...draft, fields: move(draft.fields, index, -1) };
  if (action === "down") return { ...draft, fields: move(draft.fields, index, 1) };
  return draft;
}

/** Blank ids and repeated ids cannot be saved. */
export function typeFieldError(fields: readonly { id: string }[]): string | undefined {
  const seen = new Set<string>();
  for (const field of fields) {
    const id = field.id.trim();
    if (!id) return "Each field needs an id.";
    if (seen.has(id)) return `Field ${id} is listed twice.`;
    seen.add(id);
  }
  return undefined;
}

export function renderTypeForm(draft: TypeDraft, layouts: readonly LayoutChoice[]): string {
  const choices = choicesFor(draft.layoutId, layouts);
  const rows = draft.fields.map((field, index) => fieldHtml(field, index)).join("");
  const list = draft.fields.length
    ? `<ul class="editor-type-fields">${rows}</ul>`
    : `<p class="editor-type-empty">No fields yet. Title and the body zone are always available.</p>`;
  return `<div class="editor-props"><p><label for="f-type-id">Id</label>
    <input id="f-type-id" class="w3-input w3-border" value="${escapeHtml(draft.id)}" disabled /></p>
    <p><label for="f-type-layout">Layout</label>
    <select id="f-type-layout" name="type-layout" class="w3-select w3-border">${layoutOptions(draft.layoutId, choices)}</select></p></div>
    ${hidden("type-extra", draft.extra)}
    <p class="w3-text-grey">The id is the filename. A page’s Type field names it.</p>
    <p class="w3-text-grey">Pages of this type use this layout. Site default leaves the choice to the site record.</p>
    <fieldset class="editor-fieldset"><legend>Fields</legend>
      ${list}
      <p class="editor-type-add"><button type="button" class="w3-button w3-small w3-theme" data-type-action="add-field">Add field</button></p>
    </fieldset>
    <p class="w3-text-grey">Each row is a value on the page, such as date or precis. A zone with the same id shows that value when the zone has no HTML.</p>`;
}

export function draftFromControls(controls: readonly ControlValue[], id = ""): TypeDraft {
  const layout = controls.find((control) => control.name === "type-layout");
  const extra = controls.find((control) => control.name === "type-extra");
  const fields = new Map<number, { id: string; required: boolean; extra: string }>();
  for (const control of controls) {
    const match = FIELD_NAME.exec(control.name);
    if (!match) continue;
    const index = Number(match[1]);
    const key = match[2] ?? "";
    const row = fields.get(index) ?? { id: "", required: false, extra: "" };
    fields.set(index, row);
    if (key === "id") row.id = control.value;
    else if (key === "required") row.required = control.checked === true;
    else if (key === "extra") row.extra = control.value;
  }
  return {
    id,
    layoutId: layout?.value ?? "",
    extra: parseObject(extra?.value ?? ""),
    fields: [...fields.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, row]) => ({
        id: row.id,
        required: row.required,
        extra: parseObject(row.extra),
      })),
  };
}

function newField(): TypeFieldRow {
  return { id: "", required: false, extra: {} };
}

function fieldRow(value: Record<string, unknown>): TypeFieldRow {
  const extra = { ...value };
  delete extra.id;
  delete extra.required;
  return {
    id: typeof value.id === "string" ? value.id : "",
    required: value.required === true,
    extra,
  };
}

function serializeField(field: TypeFieldRow): Record<string, unknown> {
  const row: Record<string, unknown> = { ...field.extra, id: field.id.trim() };
  if (field.required) row.required = true;
  else delete row.required;
  return row;
}

function choicesFor(current: string, layouts: readonly LayoutChoice[]): LayoutChoice[] {
  if (!current || layouts.some((item) => item.id === current)) return [...layouts];
  return [{ id: current }, ...layouts];
}

function layoutOptions(current: string, layouts: readonly LayoutChoice[]): string {
  const blank = `<option value=""${!current ? " selected" : ""}>Site default</option>`;
  const rest = layouts
    .map(
      (layout) =>
        `<option value="${escapeHtml(layout.id)}"${layout.id === current ? " selected" : ""}>${escapeHtml(layout.id)}</option>`,
    )
    .join("");
  return blank + rest;
}

function fieldHtml(field: TypeFieldRow, index: number): string {
  const name = `type-field-${index}`;
  return `<li class="editor-type-item">
    ${hidden(`${name}-extra`, field.extra)}
    <div class="editor-type-line">
      <input id="f-${name}-id" name="${name}-id" class="w3-input" aria-label="Field id" placeholder="Field id" spellcheck="false" autocomplete="off" value="${escapeHtml(field.id)}" />
      <label class="editor-type-flag" for="f-${name}-required"><input id="f-${name}-required" name="${name}-required" type="checkbox" aria-label="Required"${field.required ? " checked" : ""} /> Required</label>
      ${actions(index)}
    </div>
  </li>`;
}

const ICONS = {
  up: `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M3.2 10.4 8 4.4l4.8 6"/></svg>`,
  down: `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M3.2 5.6 8 11.6l4.8-6"/></svg>`,
  remove: `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M3.6 3.6 12.4 12.4M12.4 3.6 3.6 12.4"/></svg>`,
} as const;

function actions(index: number): string {
  return `<span class="editor-type-actions">
    ${iconButton("up", "Up", ICONS.up, index)}
    ${iconButton("down", "Down", ICONS.down, index)}
    ${iconButton("remove", "Remove", ICONS.remove, index)}
  </span>`;
}

function iconButton(action: TypeAction, label: string, icon: string, index: number): string {
  return `<button type="button" class="editor-type-icon" aria-label="${label}" title="${label}" data-type-action="${action}" data-type-index="${index}">${icon}</button>`;
}

function hidden(name: string, value: unknown): string {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(JSON.stringify(value ?? {}))}" />`;
}

function move<T>(items: readonly T[], index: number, delta: number): T[] {
  const next = index + delta;
  if (index < 0 || index >= items.length || next < 0 || next >= items.length) return [...items];
  const copy = [...items];
  const [item] = copy.splice(index, 1);
  if (item === undefined) return [...items];
  copy.splice(next, 0, item);
  return copy;
}

function parseObject(text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
