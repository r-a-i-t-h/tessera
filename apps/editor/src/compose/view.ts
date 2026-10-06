import { PALETTE } from "@r-a-i-t-h/tessera-sections";
import type { PageLayoutHint } from "../api.js";
import { escapeHtml } from "../dom.js";
import { draftYaml, parsePageYaml, withZoneHtml } from "./draft.js";
import { readComposeHtml } from "./canvas.js";
import { readFormValues, renderForm } from "../forms/form.js";
import { authoredSchema, frameWhere, schemaFor, withFrameChoices, withTypeChoices } from "../forms/schema.js";

export type ContentMode = "compose" | "fields" | "raw";

type ZoneView = {
  name: string;
  label: string;
  off: boolean;
  kind: "html" | "note";
  html: string;
};

/** Compose for a template always edits one body zone, whatever page frame it names. */
export function templateBodyLayout(): PageLayoutHint {
  return {
    layoutId: "",
    layoutSource: "site",
    fields: [],
    declaredZones: ["main"],
    offLayoutZones: [],
    layouts: {},
  };
}

export function frameNote(layout?: PageLayoutHint): string {
  if (!layout?.masterLayoutId) return "";
  const where = frameWhere(layout.masterSource, layout.masterFromPageId);
  return `<p class="w3-text-grey">Frame <strong>${escapeHtml(layout.masterLayoutId)}</strong>, ${escapeHtml(where)}.</p>`;
}

export function composeFormInner(
  kind: string,
  record: Record<string, unknown>,
  layout?: PageLayoutHint,
  types?: readonly string[],
): string {
  const schema = contentSchema(kind, record, layout, types);
  const authoredNames = new Set((authoredSchema(kind)?.fields ?? []).map((field) => field.name));
  const base = schema?.fields.filter((field) => authoredNames.has(field.name)) ?? [];
  const extras =
    schema?.fields.filter((field) => !authoredNames.has(field.name) && field.name !== "locked" && field.name !== "templateId") ??
    [];
  const zones = zoneViews(record, layout);
  const onLayout = zones.filter((zone) => !zone.off);
  const offLayout = zones.filter((zone) => zone.off);
  const locked = record.locked === true;
  const palette = locked
    ? `<p class="w3-text-grey">This page's layout is fixed. Edit the words and the pictures.</p>`
    : `<div class="editor-palette">
        <p class="w3-small w3-text-grey">Drag onto the page, or click to add.</p>
        ${PALETTE.map((item) => `<button type="button" class="w3-button w3-white w3-border" draggable="true" data-palette="${item.kind}">${item.label}</button>`).join("")}
      </div>`;
  return `${renderForm({ fields: base }, record)}
    ${layoutBanner(layout)}
    ${frameNote(layout)}
    <div class="editor-compose-layout">
      ${palette}
      <div class="editor-zones">
        ${onLayout.map((zone) => zoneBlock(zone)).join("")}
        ${
          offLayout.length
            ? `<section class="editor-off-layout"><h2 class="w3-medium">Off layout</h2><p class="w3-text-grey">On this page but not declared by the layout. Still saved.</p>${offLayout.map((zone) => zoneBlock(zone)).join("")}</section>`
            : ""
        }
      </div>
    </div>
    ${extras.length ? renderForm({ fields: extras }, record) : ""}`;
}

export function htmlByZone(record: Record<string, unknown>, layout?: PageLayoutHint): Record<string, string> {
  const html: Record<string, string> = {};
  for (const zone of zoneViews(record, layout)) {
    if (zone.kind === "html") html[zone.name] = zone.html;
  }
  return html;
}

/** Current page document, including when it still matches the saved file. */
export function readContentDocument(
  form: HTMLFormElement,
  mode: ContentMode,
  current: Record<string, unknown>,
  baselineRaw: string,
  baselineData: unknown,
  kind = "content",
):
  | { ok: true; draft: Record<string, unknown>; fromEditor: boolean }
  | { ok: false; error: string } {
  try {
    if (mode === "raw") {
      const text = form.querySelector<HTMLTextAreaElement>("#raw-file")?.value ?? "";
      if (text.trimEnd() === baselineRaw.trimEnd()) {
        if (!baselineData || typeof baselineData !== "object" || Array.isArray(baselineData)) {
          return { ok: false, error: "The saved page could not be restored." };
        }
        return { ok: true, draft: structuredClone(baselineData) as Record<string, unknown>, fromEditor: false };
      }
      const parsed = parsePageYaml(text);
      if (!parsed.ok) return parsed;
      return { ok: true, draft: parsed.data, fromEditor: true };
    }
    const read = readFormValues(form, schemaFor(kind, current), current);
    if (!read || typeof read !== "object" || Array.isArray(read)) {
      return { ok: false, error: "Could not read this page." };
    }
    const draft =
      mode === "compose" ? withZoneHtml(read as Record<string, unknown>, readComposeHtml(form)) : (read as Record<string, unknown>);
    return { ok: true, draft, fromEditor: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not read this page." };
  }
}

export function readContentDraft(
  form: HTMLFormElement,
  mode: ContentMode,
  current: Record<string, unknown>,
  baselineRaw: string,
  baselineData: unknown,
  kind = "content",
):
  | { ok: true; unchanged: true }
  | { ok: true; unchanged: false; draft: Record<string, unknown>; fromEditor: boolean }
  | { ok: false; error: string } {
  if (form.dataset.dirty !== "true") return { ok: true, unchanged: true };
  const read = readContentDocument(form, mode, current, baselineRaw, baselineData, kind);
  if (!read.ok) return read;
  return { ok: true, unchanged: false, draft: read.draft, fromEditor: read.fromEditor };
}

export function rawText(fromEditor: boolean, draft: Record<string, unknown>, baselineRaw: string): string {
  return fromEditor ? draftYaml(draft) : baselineRaw;
}

function zoneBlock(zone: ZoneView): string {
  if (zone.kind === "note") {
    return `<p class="w3-text-grey"><strong>${escapeHtml(zone.label)}</strong> is structured data. Edit it on Fields.</p>`;
  }
  return `<section class="editor-zone"><h2 class="w3-medium">${escapeHtml(zone.label)}</h2><div class="editor-canvas" data-canvas data-zone="${escapeHtml(zone.name)}"></div></section>`;
}

function zoneViews(record: Record<string, unknown>, layout?: PageLayoutHint): ZoneView[] {
  const zones = zonesOf(record);
  const declared = layout?.declaredZones ?? [];
  const declaredSet = new Set(declared);
  const onNames = declared.length ? declared : Object.keys(zones);
  const offNames = declared.length ? Object.keys(zones).filter((name) => !declaredSet.has(name)) : [];
  return [
    ...onNames.map((name) => zoneView(name, zones[name], false)),
    ...offNames.map((name) => zoneView(name, zones[name], true)),
  ];
}

function zoneView(name: string, zone: unknown, off: boolean): ZoneView {
  const label = off ? `Off layout: ${name}` : name === "main" ? "Body" : `Zone: ${name}`;
  if (zone === undefined || (isRecord(zone) && "html" in zone && !("json" in zone) && !("blocks" in zone) && !("component" in zone))) {
    return { name, label, off, kind: "html", html: isRecord(zone) ? String(zone.html ?? "") : "" };
  }
  return { name, label, off, kind: "note", html: "" };
}

function zonesOf(record: Record<string, unknown>): Record<string, unknown> {
  return isRecord(record.zones) ? record.zones : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function contentSchema(
  kind: string,
  record: Record<string, unknown>,
  layout?: PageLayoutHint,
  types?: readonly string[],
) {
  const schema = schemaFor(kind, record);
  if (!schema) return schema;
  const withTypes =
    (kind === "content" || kind === "templates") && types
      ? withTypeChoices(schema, types, typeof record.type === "string" ? record.type : undefined)
      : schema;
  if (kind !== "content" || !layout?.frames) return withTypes;
  const current = typeof record.masterLayoutId === "string" ? record.masterLayoutId : undefined;
  return withFrameChoices(withTypes, layout.frames, current);
}

function layoutBanner(layout?: PageLayoutHint): string {
  if (!layout?.layoutId) return "";
  const via = layout.layoutSource === "type" ? `type ${layout.typeId ?? ""}`.trim() : "site default";
  return `<p class="w3-text-grey">Zones from layout <strong>${escapeHtml(layout.layoutId)}</strong> (${escapeHtml(via)}).</p>`;
}
