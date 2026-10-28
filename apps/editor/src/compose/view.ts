import { COMPOSE_PALETTE_GROUP_LENGTHS, PALETTE } from "@r-a-i-t-h/tessera-sections";
import type { PageLayoutHint } from "../api.js";
import { COMPOSE_LIST_EXPANDED_LABEL } from "../escape-key.js";
import { escapeHtml } from "../dom.js";
import { draftYaml, parsePageYaml, withZoneHtml } from "./draft.js";
import { readComposeHtml } from "./canvas.js";
import { readFormValues } from "../forms/form.js";
import { schemaFor } from "../forms/schema.js";

/** Controls on the Frame tab that must not be written into the page record. */
const FRAME_UI_FIELDS = new Set(["frame-zone-id", "frame-zone-pick"]);

export type ContentMode = "compose" | "frame" | "fields" | "raw";

type ZoneView = {
  name: string;
  label: string;
  off: boolean;
  kind: "html" | "note";
  html: string;
  /** On Frame tab: whether the resolved master declares this outlet. */
  active?: boolean;
};

/** Compose for a template always edits one body zone, whatever page frame it names. */
export function templateBodyLayout(): PageLayoutHint {
  return {
    layoutId: "",
    layoutSource: "site",
    fields: [],
    declaredZones: ["main"],
    offLayoutZones: [],
    frameZoneCatalog: [],
    frameEditorZones: [],
    activeFrameZoneIds: [],
    layouts: {},
  };
}

export function frameNote(layout?: PageLayoutHint): string {
  if (layout?.aspectSource !== "ancestor" || !layout.aspectFromPageId) return "";
  const label =
    layout.aspects?.find((item) => item.id === layout.aspectId)?.label ?? layout.aspectId ?? "aspect";
  return `<p class="w3-small w3-text-grey">Aspect ${escapeHtml(label)} is set on ${escapeHtml(layout.aspectFromPageId)}.</p>`;
}

/** Compose tab: page-layout zone canvases only. Page properties live on the Page tab. */
export function composeFormInner(
  kind: string,
  record: Record<string, unknown>,
  layout?: PageLayoutHint,
  _types?: readonly string[],
  _options?: { heroUrl?: string },
  _pageIds?: readonly string[],
): string {
  const zoneLayout =
    kind === "content" && record.type === "article" && layout
      ? { ...layout, declaredZones: ["main"], offLayoutZones: [] }
      : layout;
  const zones = pageLayoutZoneViews(record, zoneLayout);
  const locked = record.locked === true;
  const palette = locked ? "" : composePalette();
  return `${layoutBanner(record, zoneLayout)}
    ${frameNote(zoneLayout)}
    <div class="editor-compose-layout">
      ${palette}
      <div class="editor-zones">
        ${zones.map((zone) => zoneBlock(zone)).join("")}
      </div>
    </div>`;
}

/** Frame tab: frame / custom zone canvases only. Page properties live on the Page tab. */
export function frameFormInner(
  kind: string,
  record: Record<string, unknown>,
  layout?: PageLayoutHint,
  _types?: readonly string[],
  _options?: { heroUrl?: string },
  _pageIds?: readonly string[],
): string {
  const zoneLayout =
    kind === "content" && record.type === "article" && layout
      ? { ...layout, declaredZones: ["main"], offLayoutZones: [] }
      : layout;
  const zones = frameZoneViews(record, zoneLayout);
  const locked = record.locked === true;
  const palette = locked ? "" : composePalette();
  const master = layout?.masterLayoutId ? escapeHtml(layout.masterLayoutId) : "";
  const banner = `<p class="w3-text-grey">Frame zones paint when a layout in the render walk declares that id. Changing parent or master can leave content unused. Page body zones stay on <strong>Compose</strong>. Title, type, and rename are on <strong>Page</strong>.</p>
    ${
      master
        ? `<p class="w3-small w3-text-grey">Current frame: <code>${master}</code>${
            (layout?.activeFrameZoneIds ?? []).length
              ? ` · outlets: ${(layout?.activeFrameZoneIds ?? []).map((id) => `<code>${escapeHtml(id)}</code>`).join(", ")}`
              : " · no content zones on this frame"
          }.</p>`
        : `<p class="w3-small w3-text-grey">This page has no master frame. Saved frame zones stay on the page until a frame declares them.</p>`
    }`;
  return `${frameNote(zoneLayout)}
    ${banner}
    <div class="editor-compose-layout">
      ${palette}
      <div class="editor-zones">
        ${zones.length ? zones.map((zone) => zoneBlock(zone)).join("") : `<p class="w3-text-grey">No frame zones on this page yet. Add one below.</p>`}
        ${locked ? "" : addZoneControls(layout, zones.map((zone) => zone.name))}
      </div>
    </div>`;
}

function composePalette(): string {
  const button = (item: (typeof PALETTE)[number]) =>
    `<button type="button" class="w3-button w3-white w3-border" draggable="true" data-palette="${item.kind}">${item.label}</button>`;
  let at = 0;
  const groups = COMPOSE_PALETTE_GROUP_LENGTHS.map((length) => {
    const slice = PALETTE.slice(at, at + length);
    at += length;
    return slice.map(button).join("");
  });
  return `<div class="editor-palette">
        <p><button type="button" class="w3-button w3-white w3-border" data-compose-list aria-pressed="false">${COMPOSE_LIST_EXPANDED_LABEL}</button></p>
        ${groups.join(`<hr class="editor-palette-rule">`)}
      </div>`;
}

function addZoneControls(layout?: PageLayoutHint, usedIds: readonly string[] = []): string {
  const catalog = layout?.frameZoneCatalog ?? [];
  const used = new Set(usedIds);
  const options = catalog
    .filter((id) => !used.has(id))
    .map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(id)}</option>`)
    .join("");
  const pick =
    options.length > 0
      ? `<label class="editor-add-zone-pick">Frame zone
          <select name="frame-zone-pick" class="w3-select w3-border">
            <option value="">Choose…</option>
            ${options}
          </select>
        </label>`
      : "";
  return `<section class="editor-zone editor-add-frame-zone">
      <h2 class="w3-medium">Add zone</h2>
      <p class="w3-small w3-text-grey">Pick a zone from any frame layout, or type a custom id. Content is saved on this page and used only when a layout declares that id.</p>
      <p class="editor-add-zone-row">
        ${pick}
        <label class="editor-add-zone-custom">Custom id
          <input name="frame-zone-id" class="w3-input w3-border" autocomplete="off" spellcheck="false" placeholder="Zone id" />
        </label>
        <button type="button" class="w3-button w3-theme" data-action="add-frame-zone">Add zone</button>
      </p>
      <p class="w3-small w3-pale-red w3-padding" data-add-frame-zone-error hidden></p>
    </section>`;
}

export function htmlByZone(record: Record<string, unknown>, layout?: PageLayoutHint): Record<string, string> {
  return htmlByZoneForMode(record, layout, "compose");
}

export function htmlByZoneForMode(
  record: Record<string, unknown>,
  layout: PageLayoutHint | undefined,
  mode: "compose" | "frame",
): Record<string, string> {
  const html: Record<string, string> = {};
  const views = mode === "frame" ? frameZoneViews(record, layout) : pageLayoutZoneViews(record, layout);
  for (const zone of views) {
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
    const cleaned = dropFrameUiFields(read as Record<string, unknown>);
    const draft =
      mode === "compose" || mode === "frame"
        ? withZoneHtml(cleaned, readComposeHtml(form))
        : cleaned;
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

/** Validate and return a new frame zone id, or an error message. */
export function validateFrameZoneId(
  raw: string,
  record: Record<string, unknown>,
  layout?: PageLayoutHint,
): { ok: true; id: string } | { ok: false; error: string } {
  const id = raw.trim();
  if (!id) return { ok: false, error: "Enter a zone id." };
  if (!/^[a-zA-Z][\w-]*$/.test(id)) {
    return { ok: false, error: "Use a letter first, then letters, digits, underscore, or hyphen." };
  }
  const declared = new Set(layout?.declaredZones ?? []);
  if (record.type === "article") {
    // Article compose only edits main; title is the record title.
    if (id === "main") return { ok: false, error: "Body content belongs on Compose." };
  } else if (declared.has(id)) {
    return { ok: false, error: "That zone is on the page layout. Edit it on Compose." };
  }
  const zones = zonesOf(record);
  if (id in zones) return { ok: false, error: "This page already has that zone." };
  return { ok: true, id };
}

export function addFrameZoneToRecord(record: Record<string, unknown>, id: string): Record<string, unknown> {
  const zones = { ...zonesOf(record), [id]: { html: "" } };
  return { ...record, zones };
}

function zoneBlock(zone: ZoneView): string {
  if (zone.kind === "note") {
    return `<section class="editor-zone"><h2 class="w3-medium">${escapeHtml(zone.label)}</h2></section>`;
  }
  const note =
    zone.active === undefined
      ? ""
      : zone.active
        ? `<p class="w3-small w3-text-grey">On current frame.</p>`
        : `<p class="w3-small w3-text-grey">Not on current frame — saved but unused until a layout declares this id.</p>`;
  return `<section class="editor-zone"><h2 class="w3-medium">${escapeHtml(zone.label)}</h2>${note}<div class="editor-canvas" data-canvas data-zone="${escapeHtml(zone.name)}"></div></section>`;
}

function pageLayoutZoneViews(record: Record<string, unknown>, layout?: PageLayoutHint): ZoneView[] {
  const zones = zonesOf(record);
  const declared = layout?.declaredZones ?? [];
  const onNames = declared.length ? declared : Object.keys(zones);
  return onNames.map((name) => zoneView(name, zones[name], false));
}

function frameZoneViews(record: Record<string, unknown>, layout?: PageLayoutHint): ZoneView[] {
  const zones = zonesOf(record);
  const declared = new Set(layout?.declaredZones ?? []);
  const active = new Set(layout?.activeFrameZoneIds ?? []);
  // Prefer the draft’s keys so Add zone shows a canvas before the next API hint.
  const fromRecord = Object.keys(zones).filter((name) => {
    if (declared.has(name)) return false;
    if (record.type === "article" && name === "title") return false;
    return true;
  });
  const hinted = (layout?.frameEditorZones ?? []).filter((name) => fromRecord.includes(name));
  const names = [...hinted, ...fromRecord.filter((name) => !hinted.includes(name))];
  return names.map((name) => {
    const view = zoneView(name, zones[name], false, true);
    return { ...view, active: active.has(name) };
  });
}

const ZONE_LABELS: Record<string, string> = {
  main: "Body",
  title: "Title",
  hero: "Hero",
  lead: "Lead",
  primary: "Primary",
  aside: "Aside",
  footer: "Footer",
};

function zoneLabel(name: string, frame: boolean): string {
  if (frame) return ZONE_LABELS[name] ?? `Frame: ${name}`;
  return ZONE_LABELS[name] ?? `Zone: ${name}`;
}

function zoneView(name: string, zone: unknown, off: boolean, frame = false): ZoneView {
  const label = zoneLabel(name, frame);
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

function dropFrameUiFields(record: Record<string, unknown>): Record<string, unknown> {
  let changed = false;
  const next = { ...record };
  for (const key of FRAME_UI_FIELDS) {
    if (key in next) {
      delete next[key];
      changed = true;
    }
  }
  return changed ? next : record;
}

function layoutBanner(_record: Record<string, unknown>, _layout?: PageLayoutHint): string {
  return "";
}
