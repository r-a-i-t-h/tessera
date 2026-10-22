import { escapeHtml, formErrorPanel } from "../dom.js";
import type { PageTargetChoices } from "./page-target.js";
import { serializePageTargetChoices } from "./page-target.js";
import { pageIdError } from "./page.js";
import { folderChecklist } from "./picker.js";
import type { ControlValue } from "./nav.js";
import {
  blankDataset,
  datasetDraft,
  datasetDraftFromForm,
  datasetFields,
  datasetPhrase,
  datasetRecord,
  datasetBindingError,
  presentationForComponent,
  renderDatasetForm,
  type DatasetBindingChoices,
  type DatasetDraft,
} from "./dataset-binding.js";

export type BindingKind = "gallery" | "dated" | "people" | "links" | "imageReveal" | "embed" | "dataset" | "other";

const IMAGE_REVEAL_SLOT_COUNT = 6;

export type ImageRevealPanelDraft = {
  url: string;
  href: string;
  title: string;
};

export type ImageRevealDraft = {
  width: string;
  height: string;
  panelsPerRow: string;
  hoverExpand: string;
  hoverGap: string;
  navigateDelay: string;
  titleSize: string;
  panels: ImageRevealPanelDraft[];
  propsExtra: Record<string, unknown>;
  recordExtra: Record<string, unknown>;
};

export type GalleryMode = "grid" | "slides";
export type DateWindow = "upcoming" | "past" | "all";
export type LinkSource = "children" | "type" | "nav";
export type LinkVariant = "list" | "pills" | "cards";

export type GalleryDraft = {
  folders: string[];
  filter: string;
  mode: GalleryMode;
  autoplay: boolean;
  propsExtra: Record<string, unknown>;
  recordExtra: Record<string, unknown>;
};

export type DatedDraft = {
  types: string[];
  when: DateWindow;
  limit: string;
  empty: string;
  propsExtra: Record<string, unknown>;
  recordExtra: Record<string, unknown>;
};

export type PeopleDraft = {
  types: string[];
  limit: string;
  propsExtra: Record<string, unknown>;
  recordExtra: Record<string, unknown>;
};

export type LinksDraft = {
  title: string;
  source: LinkSource;
  type: string;
  heading: string;
  variant: LinkVariant;
  propsExtra: Record<string, unknown>;
  recordExtra: Record<string, unknown>;
};

export type EmbedDraft = {
  html: string;
  propsExtra: Record<string, unknown>;
  recordExtra: Record<string, unknown>;
};

export type PageUse = { id: string; title?: string };

export type BindingChoices = DatasetBindingChoices & {
  folders: readonly { id: string }[];
  types: readonly string[];
  headings: readonly string[];
  pageTargets?: PageTargetChoices;
};

export type NewBinding = {
  kind: BindingKind;
  id: string;
  step: 1 | 2 | 3;
  component: string;
  gallery: GalleryDraft;
  dated: DatedDraft;
  people: PeopleDraft;
  links: LinksDraft;
  imageReveal: ImageRevealDraft;
  embed: EmbedDraft;
  dataset: DatasetDraft;
};

const TOKEN = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

export function bindingKind(data: unknown): BindingKind {
  if (!isRecord(data) || typeof data.component !== "string") return "other";
  if (data.component === "gallery") return "gallery";
  if (data.component === "datedList") return "dated";
  if (data.component === "peopleGrid") return "people";
  if (data.component === "linkCluster") return "links";
  if (data.component === "imageRevealGallery") return "imageReveal";
  if (data.component === "htmlEmbed") return "embed";
  if (presentationForComponent(data.component)) return "dataset";
  return "other";
}

export function blankNewBinding(): NewBinding {
  return {
    kind: "gallery",
    id: "",
    step: 1,
    component: "",
    gallery: blankGallery(),
    dated: blankDated(),
    people: blankPeople(),
    links: blankLinks(),
    imageReveal: blankImageReveal(),
    embed: blankEmbed(),
    dataset: blankDataset(),
  };
}

export function galleryDraft(data: unknown): GalleryDraft {
  const record = isRecord(data) ? data : {};
  const props = isRecord(record.props) ? record.props : {};
  const propsExtra = { ...props };
  delete propsExtra.folders;
  delete propsExtra.folder;
  delete propsExtra.filter;
  delete propsExtra.mode;
  delete propsExtra.autoplay;
  return {
    folders: stringList(props.folders ?? props.folder),
    filter: typeof props.filter === "string" ? props.filter : "",
    mode: props.mode === "slides" ? "slides" : "grid",
    autoplay: props.autoplay === true || props.autoplay === "true",
    propsExtra,
    recordExtra: recordExtra(record),
  };
}

export function galleryRecord(id: string, draft: GalleryDraft): Record<string, unknown> {
  const props: Record<string, unknown> = { ...draft.propsExtra };
  if (draft.folders.length) props.folders = [...draft.folders];
  else delete props.folders;
  const filter = draft.filter.trim();
  if (filter) props.filter = filter;
  else delete props.filter;
  props.mode = draft.mode;
  if (draft.mode === "slides" && draft.autoplay) props.autoplay = true;
  else delete props.autoplay;
  return { ...draft.recordExtra, id, component: "gallery", props };
}

export function datedDraft(data: unknown): DatedDraft {
  const record = isRecord(data) ? data : {};
  const props = isRecord(record.props) ? record.props : {};
  const propsExtra = { ...props };
  delete propsExtra.types;
  delete propsExtra.type;
  delete propsExtra.when;
  delete propsExtra.upcoming;
  delete propsExtra.limit;
  delete propsExtra.empty;
  return {
    types: stringList(props.types ?? props.type),
    when: dateWindow(props),
    limit: limitText(props.limit),
    empty: typeof props.empty === "string" ? props.empty : "",
    propsExtra,
    recordExtra: recordExtra(record),
  };
}

export function datedRecord(id: string, draft: DatedDraft): Record<string, unknown> {
  const props: Record<string, unknown> = { ...draft.propsExtra };
  if (draft.types.length) props.types = [...draft.types];
  else delete props.types;
  delete props.type;
  props.when = draft.when;
  delete props.upcoming;
  const limit = limitNumber(draft.limit);
  if (limit !== undefined) props.limit = limit;
  else delete props.limit;
  const empty = draft.empty.trim();
  if (empty) props.empty = empty;
  else delete props.empty;
  return { ...draft.recordExtra, id, component: "datedList", props };
}

export function peopleDraft(data: unknown): PeopleDraft {
  const record = isRecord(data) ? data : {};
  const props = isRecord(record.props) ? record.props : {};
  const propsExtra = { ...props };
  delete propsExtra.types;
  delete propsExtra.type;
  delete propsExtra.limit;
  return {
    types: stringList(props.types ?? props.type),
    limit: limitText(props.limit),
    propsExtra,
    recordExtra: recordExtra(record),
  };
}

export function peopleRecord(id: string, draft: PeopleDraft): Record<string, unknown> {
  const props: Record<string, unknown> = { ...draft.propsExtra };
  if (draft.types.length) props.types = [...draft.types];
  else delete props.types;
  delete props.type;
  const limit = limitNumber(draft.limit);
  if (limit !== undefined) props.limit = limit;
  else delete props.limit;
  const out: Record<string, unknown> = { ...draft.recordExtra, id, component: "peopleGrid" };
  if (Object.keys(props).length) out.props = props;
  return out;
}

export function linksDraft(data: unknown): LinksDraft {
  const record = isRecord(data) ? data : {};
  const props = isRecord(record.props) ? record.props : {};
  const propsExtra = { ...props };
  delete propsExtra.title;
  delete propsExtra.source;
  delete propsExtra.type;
  delete propsExtra.heading;
  delete propsExtra.variant;
  return {
    title: typeof props.title === "string" ? props.title : "",
    source: props.source === "type" || props.source === "nav" ? props.source : "children",
    type: typeof props.type === "string" ? props.type : "",
    heading: typeof props.heading === "string" ? props.heading : "",
    variant: props.variant === "pills" || props.variant === "cards" ? props.variant : "list",
    propsExtra,
    recordExtra: recordExtra(record),
  };
}

export function embedDraft(data: unknown): EmbedDraft {
  const record = isRecord(data) ? data : {};
  const props = isRecord(record.props) ? record.props : {};
  const propsExtra = { ...props };
  delete propsExtra.html;
  return {
    html: typeof props.html === "string" ? props.html : "",
    propsExtra,
    recordExtra: recordExtra(record),
  };
}

export function embedRecord(id: string, draft: EmbedDraft): Record<string, unknown> {
  const props: Record<string, unknown> = { ...draft.propsExtra };
  if (draft.html) props.html = draft.html;
  else delete props.html;
  const out: Record<string, unknown> = { ...draft.recordExtra, id, component: "htmlEmbed" };
  if (Object.keys(props).length) out.props = props;
  return out;
}

export function embedDraftFromForm(controls: readonly ControlValue[]): EmbedDraft {
  return {
    html: valueOf(controls, "embed-html"),
    propsExtra: parseObject(valueOf(controls, "embed-props-extra")),
    recordExtra: parseObject(valueOf(controls, "embed-record-extra")),
  };
}

const BINDING_CONTROL_PREFIXES = ["binding-", "gallery-", "dated-", "people-", "links-", "ir-", "embed-", "dataset-"] as const;

/** Named controls on binding create/edit forms (excludes unrelated fields on the same page). */
export function bindingControls(form: HTMLFormElement): ControlValue[] {
  const controls: ControlValue[] = [];
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
      continue;
    }
    if (!el.name || !BINDING_CONTROL_PREFIXES.some((prefix) => el.name.startsWith(prefix))) continue;
    controls.push({
      name: el.name,
      value: el.value,
      checked: el instanceof HTMLInputElement && el.type === "checkbox" ? el.checked : undefined,
    });
  }
  return controls;
}

export function renderEmbedForm(id: string, draft: EmbedDraft): string {
  return `${insertLine(id)}${hiddenExtra("embed", draft.propsExtra, draft.recordExtra)}
    <p class="w3-small w3-text-grey">Third-party markup (tickets, payments, maps, etc.). Put it on a page with Compose → Insert. Scripts and iframes are kept on the published site.</p>
    <p><label>HTML <textarea class="w3-input w3-border editor-html" name="embed-html" rows="14" spellcheck="false">${escapeHtml(draft.html)}</textarea></label></p>`;
}

export function linksRecord(id: string, draft: LinksDraft): Record<string, unknown> {
  const props: Record<string, unknown> = { ...draft.propsExtra, source: draft.source, variant: draft.variant };
  const title = draft.title.trim();
  if (title) props.title = title;
  else delete props.title;
  if (draft.source === "type" && draft.type.trim()) props.type = draft.type.trim();
  else delete props.type;
  if (draft.source === "nav" && draft.heading.trim()) props.heading = draft.heading.trim();
  else delete props.heading;
  return { ...draft.recordExtra, id, component: "linkCluster", props };
}

export function imageRevealDraft(data: unknown): ImageRevealDraft {
  const record = isRecord(data) ? data : {};
  const props = isRecord(record.props) ? record.props : {};
  const propsExtra = { ...props };
  delete propsExtra.items;
  delete propsExtra.width;
  delete propsExtra.height;
  delete propsExtra.panelsPerRow;
  delete propsExtra.layout;
  delete propsExtra.hoverExpand;
  delete propsExtra.hoverGap;
  delete propsExtra.navigateDelay;
  delete propsExtra.titleSize;
  delete propsExtra.autoposition;
  const rawItems = Array.isArray(props.items) ? props.items : [];
  const panels: ImageRevealPanelDraft[] = rawItems.map((row) => panelDraftFromRow(row));
  while (panels.length < IMAGE_REVEAL_SLOT_COUNT) panels.push(blankImageRevealPanel());
  return {
    width: numText(props.width, "700"),
    height: numText(props.height, "300"),
    panelsPerRow: numText(props.panelsPerRow, "3"),
    hoverExpand: numText(props.hoverExpand, "30"),
    hoverGap: nonNegText(props.hoverGap, 10),
    navigateDelay: numText(props.navigateDelay, "2500"),
    titleSize: titleSizeText(props.titleSize ?? props["title-size"]),
    panels,
    propsExtra,
    recordExtra: recordExtra(record),
  };
}

export function imageRevealRecord(id: string, draft: ImageRevealDraft): Record<string, unknown> {
  const props: Record<string, unknown> = { ...draft.propsExtra };
  delete props["title-size"];
  delete props.titleSize;
  props.width = Number(draft.width.trim()) || 700;
  props.height = Number(draft.height.trim()) || 300;
  props.panelsPerRow = clampPanelsPerRowText(draft.panelsPerRow);
  props.hoverExpand = Number(draft.hoverExpand.trim()) || 30;
  props.hoverGap = nonNegNumber(draft.hoverGap, 10);
  props.navigateDelay = Number(draft.navigateDelay.trim()) || 2500;
  props.titleSize = titleSizeNumber(draft.titleSize);
  delete props.layout;
  delete props.autoposition;
  props.items = draft.panels
    .map((panel) => panelToItem(panel))
    .filter((item): item is Record<string, unknown> => item !== null);
  return { ...draft.recordExtra, id, component: "imageRevealGallery", props };
}

export function imageRevealDraftFromForm(controls: readonly ControlValue[]): ImageRevealDraft {
  const urls = valuesOf(controls, "ir-panel-url");
  const hrefs = valuesOf(controls, "ir-panel-href");
  const titles = valuesOf(controls, "ir-panel-title");
  const count = Math.max(urls.length, hrefs.length, titles.length, IMAGE_REVEAL_SLOT_COUNT);
  const panels: ImageRevealPanelDraft[] = [];
  for (let i = 0; i < count; i += 1) {
    panels.push({
      url: urls[i] ?? "",
      href: hrefs[i] ?? "",
      title: titles[i] ?? "",
    });
  }
  while (panels.length < IMAGE_REVEAL_SLOT_COUNT) panels.push(blankImageRevealPanel());
  return {
    width: valueOf(controls, "ir-width").trim() || "700",
    height: valueOf(controls, "ir-height").trim() || "300",
    panelsPerRow: valueOf(controls, "ir-panels-per-row").trim() || "3",
    hoverExpand: valueOf(controls, "ir-hover-expand").trim() || "30",
    hoverGap: nonNegText(valueOf(controls, "ir-hover-gap"), 10),
    navigateDelay: valueOf(controls, "ir-navigate-delay").trim() || "2500",
    titleSize: titleSizeText(controlValue(controls, "ir-title-size")),
    panels,
    propsExtra: parseObject(valueOf(controls, "ir-props-extra")),
    recordExtra: parseObject(valueOf(controls, "ir-record-extra")),
  };
}

export function renderImageRevealForm(id: string, draft: ImageRevealDraft, choices?: BindingChoices): string {
  return `${pageTargetChoicesField(choices?.pageTargets)}${insertLine(id)}${hiddenExtra("ir", draft.propsExtra, draft.recordExtra)}
    <fieldset class="editor-fieldset"><legend>Banner</legend>
      ${imageRevealStageFields(draft)}
    </fieldset>
    <fieldset class="editor-fieldset"><legend>Panels</legend>
      <p class="w3-small w3-text-grey">Up to six panels; blank slots are skipped. Images should match full banner size. Order fills left to right, then down. Link is a page id or external URL.</p>
      ${imageRevealPanelFields(draft.panels)}
    </fieldset>`;
}

/** Whole numbers only. A blank limit lists every match. */
export function limitError(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^[1-9]\d*$/.test(trimmed)) return "Limit must be a whole number.";
  return undefined;
}

export function bindingIdError(id: string, existingIds: readonly string[]): string | undefined {
  return pageIdError(id, existingIds)?.replace("A page with id", "A binding with id");
}

export function bindingSentence(data: unknown, pages: readonly PageUse[] = []): string {
  const kind = bindingKind(data);
  const detail =
    kind === "gallery"
      ? galleryPhrase(galleryDraft(data))
      : kind === "dated"
        ? datedPhrase(datedDraft(data))
        : kind === "people"
          ? peoplePhrase(peopleDraft(data))
          : kind === "links"
            ? linksPhrase(linksDraft(data))
            : kind === "imageReveal"
              ? imageRevealPhrase(imageRevealDraft(data))
              : kind === "embed"
                ? embedPhrase(embedDraft(data))
                : kind === "dataset"
                  ? datasetPhrase(datasetDraft(data))
                  : otherPhrase(data);
  return `${detail}${usagePhrase(pages)}`;
}

/** Binding ids written as `{{id}}` anywhere in a record. */
export function bindingIdsIn(value: unknown): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  walk(value);
  return found;

  function walk(item: unknown): void {
    if (typeof item === "string") {
      for (const match of item.matchAll(TOKEN)) {
        const id = match[1];
        if (!id || seen.has(id)) continue;
        seen.add(id);
        found.push(id);
      }
      return;
    }
    if (Array.isArray(item)) {
      for (const entry of item) walk(entry);
      return;
    }
    if (isRecord(item)) {
      for (const entry of Object.values(item)) walk(entry);
    }
  }
}

/** Heading text from a nav record, in document order. */
export function navHeadings(data: unknown): string[] {
  const found: string[] = [];
  walk(data);
  return found;

  function walk(item: unknown): void {
    if (Array.isArray(item)) {
      for (const entry of item) walk(entry);
      return;
    }
    if (!isRecord(item)) return;
    if (typeof item.heading === "string" && item.heading.trim()) found.push(item.heading.trim());
    if (Array.isArray(item.children)) walk(item.children);
  }
}

export function renderBindingForm(id: string, data: unknown, choices: BindingChoices): string {
  const kind = bindingKind(data);
  if (kind === "gallery") return renderGalleryForm(id, galleryDraft(data), choices.folders);
  if (kind === "dated") return renderDatedForm(id, datedDraft(data), choices.types);
  if (kind === "people") return renderPeopleForm(id, peopleDraft(data), choices.types);
  if (kind === "links") return renderLinksForm(id, linksDraft(data), choices);
  if (kind === "imageReveal") return renderImageRevealForm(id, imageRevealDraft(data), choices);
  if (kind === "embed") return renderEmbedForm(id, embedDraft(data));
  if (kind === "dataset") return renderDatasetForm(id, datasetDraft(data), choices);
  return "";
}

export function renderGalleryForm(id: string, draft: GalleryDraft, folders: readonly { id: string }[]): string {
  return `${galleryIntro()}${insertLine(id)}${hiddenExtra("gallery", draft.propsExtra, draft.recordExtra)}
    <fieldset class="editor-fieldset"><legend>Pictures</legend>
      ${pictureFields(draft, folders)}
    </fieldset>
    <fieldset class="editor-fieldset"><legend>Look</legend>
      ${lookFields(draft)}
    </fieldset>`;
}

export function renderDatedForm(id: string, draft: DatedDraft, types: readonly string[]): string {
  return `${insertLine(id)}${hiddenExtra("dated", draft.propsExtra, draft.recordExtra)}${datedFields(draft, types)}`;
}

export function renderPeopleForm(id: string, draft: PeopleDraft, types: readonly string[]): string {
  return `${insertLine(id)}${hiddenExtra("people", draft.propsExtra, draft.recordExtra)}${peopleFields(draft, types)}`;
}

export function renderLinksForm(id: string, draft: LinksDraft, choices: BindingChoices): string {
  return `${insertLine(id)}${hiddenExtra("links", draft.propsExtra, draft.recordExtra)}${linksFields(draft, choices)}`;
}

export function galleryDraftFromForm(controls: readonly ControlValue[], folderIds: readonly string[]): GalleryDraft {
  const mode: GalleryMode = valueOf(controls, "gallery-mode") === "slides" ? "slides" : "grid";
  return {
    folders: [...folderIds],
    filter: valueOf(controls, "gallery-filter").trim(),
    mode,
    autoplay: mode === "slides" && flag(controls, "gallery-autoplay"),
    propsExtra: parseObject(valueOf(controls, "gallery-props-extra")),
    recordExtra: parseObject(valueOf(controls, "gallery-record-extra")),
  };
}

export function datedDraftFromForm(controls: readonly ControlValue[]): DatedDraft {
  return {
    types: checkedValues(controls, "dated-type"),
    when: dateWindow({ when: valueOf(controls, "dated-when") }),
    limit: valueOf(controls, "dated-limit"),
    empty: valueOf(controls, "dated-empty"),
    propsExtra: parseObject(valueOf(controls, "dated-props-extra")),
    recordExtra: parseObject(valueOf(controls, "dated-record-extra")),
  };
}

export function peopleDraftFromForm(controls: readonly ControlValue[]): PeopleDraft {
  return {
    types: checkedValues(controls, "people-type"),
    limit: valueOf(controls, "people-limit"),
    propsExtra: parseObject(valueOf(controls, "people-props-extra")),
    recordExtra: parseObject(valueOf(controls, "people-record-extra")),
  };
}

export function linksDraftFromForm(controls: readonly ControlValue[]): LinksDraft {
  const source = valueOf(controls, "links-source");
  const variant = valueOf(controls, "links-variant");
  return {
    title: valueOf(controls, "links-title"),
    source: source === "type" || source === "nav" ? source : "children",
    type: valueOf(controls, "links-type"),
    heading: valueOf(controls, "links-heading"),
    variant: variant === "pills" || variant === "cards" ? variant : "list",
    propsExtra: parseObject(valueOf(controls, "links-props-extra")),
    recordExtra: parseObject(valueOf(controls, "links-record-extra")),
  };
}

export function renderNewBinding(state: NewBinding, choices: BindingChoices): string {
  if (state.kind === "gallery" && state.step > 1) return galleryWizard(state, choices);
  if (state.kind === "imageReveal" && state.step > 1) return imageRevealWizard(state, choices);
  const multiStep = state.kind === "gallery" || state.kind === "imageReveal";
  return `${kindField(state)}
    ${idField(state)}
    ${state.kind === "gallery" ? `${carryPictures(state.gallery)}${carryLook(state.gallery)}` : kindBody(state, choices)}
    ${formErrorPanel()}
    ${newBindingActions(multiStep ? "Next" : "Create binding")}`;
}

function newBindingActions(submitLabel: string, options?: { back?: boolean }): string {
  const lead = options?.back
    ? `<button type="button" class="w3-button w3-white" data-binding-step="back">Back</button> `
    : `<button type="button" class="w3-button w3-white" data-binding-cancel>Cancel</button> `;
  return `<p>${lead}<button type="submit" class="w3-button w3-theme">${submitLabel}</button></p>`;
}

/**
 * Read the new-binding form. `folderIds` is the checklist when it is on the page;
 * otherwise folders travel in hidden `gallery-folder` inputs.
 */
export function readNewBinding(
  controls: readonly ControlValue[],
  folderIds?: readonly string[],
  choices?: BindingChoices,
  form?: HTMLFormElement,
): NewBinding {
  const kind = parseKind(valueOf(controls, "binding-kind"));
  const step = parseStep(valueOf(controls, "binding-step"));
  const folders = folderIds ? [...folderIds] : valuesOf(controls, "gallery-folder");
  const gallery = blankGallery();
  gallery.folders = folders;
  gallery.filter = valueOf(controls, "gallery-filter").trim();
  gallery.mode = valueOf(controls, "gallery-mode") === "slides" ? "slides" : "grid";
  gallery.autoplay = gallery.mode === "slides" && flag(controls, "gallery-autoplay");
  return {
    kind,
    id: valueOf(controls, "binding-id"),
    step,
    component: valueOf(controls, "binding-component"),
    gallery,
    dated: controls.some((control) => control.name === "dated-when" || control.name === "dated-type")
      ? datedDraftFromForm(controls)
      : blankDated(),
    people: controls.some((control) => control.name === "people-limit" || control.name === "people-type")
      ? peopleDraftFromForm(controls)
      : blankPeople(),
    links: controls.some((control) => control.name === "links-source") ? linksDraftFromForm(controls) : blankLinks(),
    imageReveal: controls.some((control) => control.name === "ir-width" || control.name === "ir-panel-url")
      ? imageRevealDraftFromForm(controls)
      : blankImageReveal(),
    embed: controls.some((control) => control.name === "embed-html") ? embedDraftFromForm(controls) : blankEmbed(),
    dataset: controls.some((control) => control.name === "dataset-dataset" || control.name === "dataset-presentation")
      ? datasetDraftFromForm(controls, choices, form)
      : blankDataset(),
  };
}

export function newBindingRecord(state: NewBinding): Record<string, unknown> {
  const id = state.id.trim();
  if (state.kind === "gallery") return galleryRecord(id, state.gallery);
  if (state.kind === "dated") return datedRecord(id, state.dated);
  if (state.kind === "people") return peopleRecord(id, state.people);
  if (state.kind === "links") return linksRecord(id, state.links);
  if (state.kind === "imageReveal") return imageRevealRecord(id, state.imageReveal);
  if (state.kind === "embed") return embedRecord(id, state.embed);
  if (state.kind === "dataset") return datasetRecord(id, state.dataset);
  return { id, component: state.component.trim() };
}

export function newBindingError(
  state: NewBinding,
  existingIds: readonly string[],
  choices?: BindingChoices,
): string | undefined {
  const idProblem = bindingIdError(state.id, existingIds);
  if (idProblem) return idProblem;
  if (state.kind === "dated") return limitError(state.dated.limit);
  if (state.kind === "people") return limitError(state.people.limit);
  if (state.kind === "links" && state.links.source === "type" && !state.links.type.trim()) return "Choose a type.";
  if (state.kind === "links" && state.links.source === "nav" && !state.links.heading.trim()) return "Enter a menu heading.";
  if (state.kind === "imageReveal") return imageRevealError(state.imageReveal);
  if (state.kind === "dataset") return datasetBindingError(state.dataset, choices);
  if (state.kind === "other" && !state.component.trim()) return "Enter a component name.";
  return undefined;
}

function imageRevealWizard(state: NewBinding, choices: BindingChoices): string {
  const token = `{{${state.id.trim() || "id"}}}`;
  return `<p>Reveal banner <code>${escapeHtml(token)}</code></p>
    ${pageTargetChoicesField(choices.pageTargets)}
    <input type="hidden" name="binding-kind" value="imageReveal" />
    <input type="hidden" name="binding-id" value="${escapeHtml(state.id)}" />
    <input type="hidden" name="binding-step" value="2" />
    <fieldset class="editor-fieldset"><legend>Banner</legend>
      ${imageRevealStageFields(state.imageReveal, true)}
    </fieldset>
    <fieldset class="editor-fieldset"><legend>Panels</legend>
      <p class="w3-small w3-text-grey">Up to six panels; blank slots are skipped. Use Library for each image. Link is a page id or external URL.</p>
      ${imageRevealPanelFields(state.imageReveal.panels, true)}
    </fieldset>
    ${formErrorPanel()}
    ${newBindingActions("Create binding", { back: true })}`;
}

function galleryWizard(state: NewBinding, choices: BindingChoices): string {
  const token = `{{${state.id.trim() || "id"}}}`;
  if (state.step === 2) {
    return `<p>Gallery <code>${escapeHtml(token)}</code></p>
      <input type="hidden" name="binding-kind" value="gallery" />
      <input type="hidden" name="binding-id" value="${escapeHtml(state.id)}" />
      <input type="hidden" name="binding-step" value="2" />
      ${carryLook(state.gallery)}
      <fieldset class="editor-fieldset"><legend>Pictures</legend>
        ${pictureFields(state.gallery, choices.folders, true)}
      </fieldset>
      ${formErrorPanel()}
      ${newBindingActions("Next", { back: true })}`;
  }
  return `<p>Gallery <code>${escapeHtml(token)}</code></p>
    <input type="hidden" name="binding-kind" value="gallery" />
    <input type="hidden" name="binding-id" value="${escapeHtml(state.id)}" />
    <input type="hidden" name="binding-step" value="3" />
    ${carryPictures(state.gallery)}
    <fieldset class="editor-fieldset"><legend>Look</legend>
      ${lookFields(state.gallery, true)}
    </fieldset>
    ${formErrorPanel()}
    ${newBindingActions("Create binding", { back: true })}`;
}

function kindField(state: NewBinding): string {
  const kinds: { value: BindingKind; label: string }[] = [
    { value: "gallery", label: "Gallery" },
    { value: "dated", label: "Dated list" },
    { value: "people", label: "People grid" },
    { value: "links", label: "Link group" },
    { value: "imageReveal", label: "Reveal banner" },
    { value: "embed", label: "Embed" },
    { value: "dataset", label: "Dataset list" },
    { value: "other", label: "Something else" },
  ];
  return `<input type="hidden" name="binding-step" value="1" />
    <p><label for="new-binding-kind">Kind</label>
      <select id="new-binding-kind" name="binding-kind" class="w3-select w3-border w3-margin-top">${kinds
        .map(
          (item) =>
            `<option value="${item.value}"${item.value === state.kind ? " selected" : ""}>${item.label}</option>`,
        )
        .join("")}</select></p>
`;
}

function idField(state: NewBinding): string {
  return `<p><label for="new-binding-id">Id</label>
      <input id="new-binding-id" name="binding-id" class="w3-input w3-border w3-margin-top" required autocomplete="off" spellcheck="false" data-binding-focus value="${escapeHtml(state.id)}" /></p>
`;
}

function kindBody(state: NewBinding, choices: BindingChoices): string {
  if (state.kind === "dated") return datedFields(state.dated, choices.types);
  if (state.kind === "people") return peopleFields(state.people, choices.types);
  if (state.kind === "links") return linksFields(state.links, choices);
  if (state.kind === "imageReveal") {
    return `<p class="w3-small w3-text-grey">Cropped image panels with hover and click-to-reveal. Configure panels on the next step, then insert with Compose → Insert.</p>`;
  }
  if (state.kind === "embed") {
    return `<p class="w3-small w3-text-grey">Paste embed code from a ticket vendor, payment provider, or similar. Insert with Compose → Insert after saving.</p>
    <p><label>HTML <textarea class="w3-input w3-border editor-html" name="embed-html" rows="14" spellcheck="false">${escapeHtml(state.embed.html)}</textarea></label></p>`;
  }
  if (state.kind === "dataset") {
    return datasetFields(state.dataset, choices);
  }
  return `<div class="editor-props"><p><label for="new-binding-component">Component</label>
    <input id="new-binding-component" name="binding-component" class="w3-input w3-border" spellcheck="false" autocomplete="off" value="${escapeHtml(state.component)}" /></p>
</div>`;
}

function galleryIntro(): string {
  return "";
}

function insertLine(_id: string): string {
  return "";
}

function pictureFields(draft: GalleryDraft, folders: readonly { id: string }[], focusFilter = false): string {
  const listed = listedFolders(draft.folders, folders);
  const checks = listed.length
    ? folderChecklist(listed, draft.folders)
    : "";
  return `<div class="editor-props">${checks}
    <p><label for="gallery-filter">Only filenames matching</label>
      <input id="gallery-filter" name="gallery-filter" class="w3-input w3-border" spellcheck="false" placeholder="2024" value="${escapeHtml(draft.filter)}"${focusFilter ? " data-binding-focus" : ""} /></p>
</div>`;
}

function lookFields(draft: GalleryDraft, focus = false): string {
  return `<div class="editor-props"><p><label for="gallery-mode">Mode</label>
      <select id="gallery-mode" name="gallery-mode" class="w3-select w3-border"${focus ? " data-binding-focus" : ""}>
        <option value="grid"${draft.mode === "grid" ? " selected" : ""}>Grid</option>
        <option value="slides"${draft.mode === "slides" ? " selected" : ""}>Slides</option>
      </select></p>
    <p class="editor-check" data-gallery-autoplay${draft.mode === "slides" ? "" : " hidden"}><label><input name="gallery-autoplay" type="checkbox"${draft.autoplay ? " checked" : ""} /> Autoplay</label></p></div>`;
}

function datedFields(draft: DatedDraft, types: readonly string[]): string {
  return `<fieldset class="editor-fieldset"><legend>Types</legend>
      <div class="editor-props">${typeChecklist("dated-type", draft.types, types)}</div>
    </fieldset>
    <div class="editor-props">
    <p><label for="dated-when">When</label>
      <select id="dated-when" name="dated-when" class="w3-select w3-border">
        <option value="upcoming"${draft.when === "upcoming" ? " selected" : ""}>Upcoming</option>
        <option value="past"${draft.when === "past" ? " selected" : ""}>Past</option>
        <option value="all"${draft.when === "all" ? " selected" : ""}>All</option>
      </select></p>
    <p><label for="dated-limit">Limit</label>
      <input id="dated-limit" name="dated-limit" class="w3-input w3-border" inputmode="numeric" value="${escapeHtml(draft.limit)}" /></p>
    <p><label for="dated-empty">Empty message</label>
      <input id="dated-empty" name="dated-empty" class="w3-input w3-border" value="${escapeHtml(draft.empty)}" /></p></div>`;
}

function peopleFields(draft: PeopleDraft, types: readonly string[]): string {
  return `<fieldset class="editor-fieldset"><legend>Types</legend>
      <div class="editor-props">${typeChecklist("people-type", draft.types, types)}</div>
    </fieldset>
    <div class="editor-props">
    <p><label for="people-limit">Limit</label>
      <input id="people-limit" name="people-limit" class="w3-input w3-border" inputmode="numeric" value="${escapeHtml(draft.limit)}" /></p>
</div>`;
}

function linksFields(draft: LinksDraft, choices: BindingChoices): string {
  return `<div class="editor-props"><p><label for="links-title">Title</label>
      <input id="links-title" name="links-title" class="w3-input w3-border" value="${escapeHtml(draft.title)}" /></p>
    <p><label for="links-source">Source</label>
      <select id="links-source" name="links-source" class="w3-select w3-border">
        <option value="children"${draft.source === "children" ? " selected" : ""}>This page's children</option>
        <option value="type"${draft.source === "type" ? " selected" : ""}>Pages of a type</option>
        <option value="nav"${draft.source === "nav" ? " selected" : ""}>A menu heading</option>
      </select></p>
    <p data-links-type${draft.source === "type" ? "" : " hidden"}><label for="links-type">Type</label>
      ${typeSelect(draft.type, choices.types)}</p>
    <p data-links-heading${draft.source === "nav" ? "" : " hidden"}><label for="links-heading">Menu heading</label>
      ${headingControl(draft.heading, choices.headings)}</p>
    <p><label for="links-variant">Look</label>
      <select id="links-variant" name="links-variant" class="w3-select w3-border">
        <option value="list"${draft.variant === "list" ? " selected" : ""}>List</option>
        <option value="pills"${draft.variant === "pills" ? " selected" : ""}>Pills</option>
        <option value="cards"${draft.variant === "cards" ? " selected" : ""}>Cards</option>
      </select></p></div>`;
}

function typeChecklist(name: string, selected: readonly string[], types: readonly string[]): string {
  const ids = [...types];
  for (const id of selected) if (id && !ids.includes(id)) ids.push(id);
  if (!ids.length) return "";
  return ids
    .map((id) => {
      const checked = selected.includes(id) ? " checked" : "";
      return `<p class="editor-check"><label><input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(id)}"${checked} /> ${escapeHtml(id)}</label></p>`;
    })
    .join("");
}

function typeSelect(current: string, types: readonly string[]): string {
  const ids = [...types];
  if (current && !ids.includes(current)) ids.unshift(current);
  const options = [`<option value=""${!current ? " selected" : ""}>Choose a type</option>`]
    .concat(
      ids.map(
        (id) => `<option value="${escapeHtml(id)}"${id === current ? " selected" : ""}>${escapeHtml(id)}</option>`,
      ),
    )
    .join("");
  return `<select id="links-type" name="links-type" class="w3-select w3-border">${options}</select>`;
}

function headingControl(current: string, headings: readonly string[]): string {
  const known = headings.filter(Boolean);
  const options = current && !known.includes(current) ? [current, ...known] : known;
  if (!options.length) {
    return `<input id="links-heading" name="links-heading" class="w3-input w3-border" value="${escapeHtml(current)}" />`;
  }
  const html = [`<option value=""${!current ? " selected" : ""}>Choose a heading</option>`]
    .concat(
      options.map(
        (heading) =>
          `<option value="${escapeHtml(heading)}"${heading === current ? " selected" : ""}>${escapeHtml(heading)}</option>`,
      ),
    )
    .join("");
  return `<select id="links-heading" name="links-heading" class="w3-select w3-border">${html}</select>`;
}

function listedFolders(selected: readonly string[], folders: readonly { id: string }[]): { id: string; parentId: null }[] {
  const ids = folders.map((folder) => folder.id);
  const extra = selected.filter((id) => id && !ids.includes(id)).map((id) => ({ id, parentId: null as null }));
  return [...folders.map((folder) => ({ id: folder.id, parentId: null as null })), ...extra];
}

function carryPictures(draft: GalleryDraft): string {
  return `${draft.folders.map((id) => `<input type="hidden" name="gallery-folder" value="${escapeHtml(id)}" />`).join("")}
    <input type="hidden" name="gallery-filter" value="${escapeHtml(draft.filter)}" />`;
}

function carryLook(draft: GalleryDraft): string {
  const autoplay = draft.autoplay ? `<input type="hidden" name="gallery-autoplay" value="true" />` : "";
  return `<input type="hidden" name="gallery-mode" value="${draft.mode}" />${autoplay}`;
}

function hiddenExtra(prefix: string, propsExtra: Record<string, unknown>, recordExtra: Record<string, unknown>): string {
  return `<input type="hidden" name="${prefix}-props-extra" value="${escapeHtml(JSON.stringify(propsExtra))}" />
    <input type="hidden" name="${prefix}-record-extra" value="${escapeHtml(JSON.stringify(recordExtra))}" />`;
}

function galleryPhrase(draft: GalleryDraft): string {
  const look = draft.mode === "slides" ? "Slides" : "Grid";
  if (!draft.folders.length) return "A gallery with no folders yet.";
  if (draft.folders.length === 1) return `${look} of the ${draft.folders[0]} folder.`;
  return `${look} of the ${joinNames(draft.folders)} folders.`;
}

function datedPhrase(draft: DatedDraft): string {
  if (!draft.types.length) return "A dated list with no type yet.";
  const names = joinNames(draft.types);
  const limit = limitNumber(draft.limit);
  if (draft.when === "upcoming") {
    return limit !== undefined ? `The next ${limit} ${names} pages.` : `Upcoming ${names} pages.`;
  }
  if (draft.when === "past") {
    return limit !== undefined ? `The latest ${limit} ${names} pages.` : `Past ${names} pages.`;
  }
  return limit !== undefined ? `The first ${limit} ${names} pages.` : `Every ${names} page.`;
}

function peoplePhrase(draft: PeopleDraft): string {
  const types = draft.types.length ? draft.types : ["person"];
  const names = joinNames(types);
  const limit = limitNumber(draft.limit);
  if (limit !== undefined) return `The first ${limit} ${names} pages.`;
  return `Every ${names} page.`;
}

function imageRevealStageFields(draft: ImageRevealDraft, focus = false): string {
  const ppr = clampPanelsPerRowText(draft.panelsPerRow);
  const pprOptions = [2, 3, 4, 5, 6]
    .map(
      (n) =>
        `<option value="${n}"${n === ppr ? " selected" : ""}>${n}</option>`,
    )
    .join("");
  return `<div class="editor-props">
    <p><label for="ir-width">Banner width</label>
      <input id="ir-width" name="ir-width" class="w3-input w3-border" inputmode="numeric" value="${escapeHtml(draft.width)}"${focus ? " data-binding-focus" : ""} /></p>
    <p><label for="ir-height">Banner height</label>
      <input id="ir-height" name="ir-height" class="w3-input w3-border" inputmode="numeric" value="${escapeHtml(draft.height)}" /></p>
    <p><label for="ir-panels-per-row">Panels per row</label>
      <select id="ir-panels-per-row" name="ir-panels-per-row" class="w3-select w3-border">${pprOptions}</select></p>
    <p><label for="ir-hover-expand">Hover grow (px)</label>
      <input id="ir-hover-expand" name="ir-hover-expand" class="w3-input w3-border" inputmode="numeric" value="${escapeHtml(draft.hoverExpand)}" /></p>
    <p><label for="ir-hover-gap">Expanded gap (px)</label>
      <input id="ir-hover-gap" name="ir-hover-gap" class="w3-input w3-border" inputmode="numeric" value="${escapeHtml(draft.hoverGap)}" /></p>
    <p><label for="ir-navigate-delay">Navigate delay (ms)</label>
      <input id="ir-navigate-delay" name="ir-navigate-delay" class="w3-input w3-border" inputmode="numeric" value="${escapeHtml(draft.navigateDelay)}" /></p>
    <p><label for="ir-title-size">Title size</label>
      <select id="ir-title-size" name="ir-title-size" class="w3-select w3-border">${titleSizeOptions(draft.titleSize)}</select></p>
    <p class="editor-prop-wide w3-small w3-text-grey">Width and height set aspect ratio and design coordinates; height on the page follows width.</p>
  </div>`;
}

function imageRevealPanelFields(panels: ImageRevealPanelDraft[], focusFirst = false): string {
  return panels
    .map((panel, index) => {
      const focus = focusFirst && index === 0 ? " data-binding-focus" : "";
      return `<div class="editor-irg-panel" data-item-id="${index}">
        <p class="w3-medium">Panel ${index + 1}</p>
        <div class="editor-props">
          <p class="editor-prop-wide editor-irg-image-row"><label for="ir-panel-url-${index}">Image</label>
            <span class="editor-irg-image-controls">
              <input id="ir-panel-url-${index}" name="ir-panel-url" class="w3-input w3-border" data-field="url" value="${escapeHtml(panel.url)}"${focus} />
              <button type="button" class="w3-button w3-small w3-white" data-library="image">Library</button>
            </span></p>
          <p><label for="ir-panel-title-${index}">Title</label>
            <textarea id="ir-panel-title-${index}" name="ir-panel-title" class="w3-input w3-border" data-field="title" rows="2">${escapeHtml(panel.title)}</textarea></p>
          <p class="editor-prop-wide editor-irg-link-row"><label for="ir-panel-href-${index}">Link</label>
            <span class="editor-irg-link-controls">
              <input id="ir-panel-href-${index}" name="ir-panel-href" class="w3-input w3-border" value="${escapeHtml(panel.href)}" />
              <button type="button" class="w3-button w3-small w3-white" data-page-target-pick>Choose page</button>
            </span></p>
        </div>
      </div>`;
    })
    .join("");
}

function imageRevealPhrase(draft: ImageRevealDraft): string {
  const count = draft.panels.filter((panel) => panel.url.trim() && panel.href.trim()).length;
  if (!count) return "A reveal banner with no panels yet.";
  const ppr = clampPanelsPerRowText(draft.panelsPerRow);
  return `Reveal banner with ${count} panel${count === 1 ? "" : "s"}, ${ppr} per row.`;
}

function imageRevealError(draft: ImageRevealDraft): string | undefined {
  const filled = draft.panels.filter((panel) => panel.url.trim() || panel.href.trim());
  if (!filled.length) return "Add at least one panel with an image and a link.";
  for (const panel of filled) {
    if (!panel.url.trim()) return "Each panel needs an image.";
    if (!panel.href.trim()) return "Each panel needs a link.";
  }
  return undefined;
}

function panelDraftFromRow(row: unknown): ImageRevealPanelDraft {
  if (!isRecord(row)) return blankImageRevealPanel();
  const title =
    typeof row.title === "string" ? row.title : typeof row.alt === "string" ? row.alt : "";
  return {
    url: typeof row.url === "string" ? row.url : "",
    href: typeof row.href === "string" ? row.href : "",
    title,
  };
}

function panelToItem(panel: ImageRevealPanelDraft): Record<string, unknown> | null {
  const url = panel.url.trim();
  const href = panel.href.trim();
  if (!url || !href) return null;
  const item: Record<string, unknown> = { url, href };
  const title = panel.title.trim();
  if (title) item.title = title;
  return item;
}

function pageTargetChoicesField(choices: PageTargetChoices | undefined): string {
  if (!choices) return "";
  return `<input type="hidden" data-page-target-choices="${escapeHtml(serializePageTargetChoices(choices))}" />`;
}

function clampPanelsPerRowText(value: string): number {
  const n = Number(value.trim());
  if (!Number.isFinite(n)) return 3;
  return Math.max(2, Math.min(6, Math.round(n)));
}

const TITLE_SIZE_CHOICES = ["1", "1.2", "1.4", "1.6", "1.8", "2"] as const;

function titleSizeText(value: unknown): string {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) return "1";
  const step = Math.max(0, Math.min(5, Math.round((n - 1) / 0.2)));
  return TITLE_SIZE_CHOICES[step] ?? "1";
}

function titleSizeNumber(text: string): number {
  return Number(titleSizeText(text));
}

function titleSizeOptions(current: string): string {
  const selected = titleSizeText(current);
  return TITLE_SIZE_CHOICES.map(
    (value) => `<option value="${value}"${value === selected ? " selected" : ""}>${value} em</option>`,
  ).join("");
}

function nonNegText(value: unknown, fallback: number): string {
  return String(nonNegNumber(value, fallback));
}

function nonNegNumber(value: unknown, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string" && !value.trim()) return fallback;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, n);
}

function numText(value: unknown, fallback: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function blankImageRevealPanel(): ImageRevealPanelDraft {
  return { url: "", href: "", title: "" };
}

function blankImageReveal(): ImageRevealDraft {
  return {
    width: "700",
    height: "300",
    panelsPerRow: "3",
    hoverExpand: "30",
    hoverGap: "10",
    navigateDelay: "2500",
    titleSize: "1",
    panels: Array.from({ length: IMAGE_REVEAL_SLOT_COUNT }, () => blankImageRevealPanel()),
    propsExtra: {},
    recordExtra: {},
  };
}

function linksPhrase(draft: LinksDraft): string {
  const look = draft.variant === "pills" ? "Pills" : draft.variant === "cards" ? "Cards" : "A list";
  if (draft.source === "type") {
    if (!draft.type.trim()) return "A list of pages, with no type chosen.";
    if (draft.variant === "list") return `A list of every ${draft.type.trim()} page.`;
    return `${look} for every ${draft.type.trim()} page.`;
  }
  if (draft.source === "nav") {
    const heading = draft.heading.trim();
    if (!heading) return "A list of a menu heading.";
    if (draft.variant === "list") return `A list of the ${heading} menu.`;
    return `${look} for the ${heading} menu.`;
  }
  if (draft.variant === "list") return "A list of this page's children.";
  return `${look} for this page's children.`;
}

function embedPhrase(draft: EmbedDraft): string {
  const trimmed = draft.html.trim();
  if (!trimmed) return "An embed with no HTML yet.";
  const lines = trimmed.split(/\r?\n/).length;
  return lines > 1 ? `Embed (${lines} lines of HTML).` : "Embed (one line of HTML).";
}

function blankEmbed(): EmbedDraft {
  return { html: "", propsExtra: {}, recordExtra: {} };
}

function otherPhrase(data: unknown): string {
  const component = isRecord(data) && typeof data.component === "string" ? data.component.trim() : "";
  if (!component) return "Edit the raw file.";
  return `${component}. Edit the raw file.`;
}

function usagePhrase(pages: readonly PageUse[]): string {
  const names = pages.map((page) => page.title?.trim() || page.id).filter(Boolean);
  if (!names.length) return "";
  if (names.length === 1) return ` On ${names[0]}.`;
  if (names.length === 2) return ` On ${names[0]} and ${names[1]}.`;
  return ` On ${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}.`;
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function blankGallery(): GalleryDraft {
  return { folders: [], filter: "", mode: "grid", autoplay: false, propsExtra: {}, recordExtra: {} };
}

function blankDated(): DatedDraft {
  return { types: [], when: "upcoming", limit: "", empty: "", propsExtra: {}, recordExtra: {} };
}

function blankPeople(): PeopleDraft {
  return { types: [], limit: "", propsExtra: {}, recordExtra: {} };
}

function blankLinks(): LinksDraft {
  return { title: "", source: "children", type: "", heading: "", variant: "list", propsExtra: {}, recordExtra: {} };
}

function dateWindow(props: Record<string, unknown>): DateWindow {
  if (props.when === "past" || props.when === "upcoming" || props.when === "all") return props.when;
  if (props.upcoming === true) return "upcoming";
  return "all";
}

function stringList(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "").map((item) => item.trim());
}

function limitText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value.trim();
  return "";
}

function limitNumber(value: string): number | undefined {
  if (limitError(value)) return undefined;
  if (!value.trim()) return undefined;
  return Number(value.trim());
}

function recordExtra(record: Record<string, unknown>): Record<string, unknown> {
  const extra = { ...record };
  delete extra.id;
  delete extra.component;
  delete extra.props;
  return extra;
}

function parseKind(value: string): BindingKind {
  if (
    value === "gallery" ||
    value === "dated" ||
    value === "people" ||
    value === "links" ||
    value === "imageReveal" ||
    value === "embed" ||
    value === "dataset" ||
    value === "other"
  ) {
    return value;
  }
  return "gallery";
}

function parseStep(value: string): 1 | 2 | 3 {
  if (value === "2") return 2;
  if (value === "3") return 3;
  return 1;
}

function valueOf(controls: readonly ControlValue[], name: string): string {
  return controls.find((control) => control.name === name)?.value ?? "";
}

/** Last matching control wins (avoids stale hidden duplicates). */
function controlValue(controls: readonly ControlValue[], name: string): string {
  const matches = controls.filter((control) => control.name === name);
  return matches.at(-1)?.value ?? "";
}

function valuesOf(controls: readonly ControlValue[], name: string): string[] {
  return controls.filter((control) => control.name === name && control.value.trim()).map((control) => control.value.trim());
}

function checkedValues(controls: readonly ControlValue[], name: string): string[] {
  return controls.filter((control) => control.name === name && control.checked).map((control) => control.value);
}

function flag(controls: readonly ControlValue[], name: string): boolean {
  const control = controls.find((item) => item.name === name);
  if (!control) return false;
  if (control.checked !== undefined) return control.checked;
  return control.value === "true";
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
