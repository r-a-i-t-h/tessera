import { escapeHtml, formErrorPanel } from "../dom.js";
import { pageIdError } from "./page.js";
import { folderChecklist } from "./picker.js";
import type { ControlValue } from "./nav.js";

export type BindingKind = "gallery" | "dated" | "people" | "links" | "other";

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

export type PageUse = { id: string; title?: string };

export type BindingChoices = {
  folders: readonly { id: string }[];
  types: readonly string[];
  headings: readonly string[];
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
};

const TOKEN = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

export function bindingKind(data: unknown): BindingKind {
  if (!isRecord(data) || typeof data.component !== "string") return "other";
  if (data.component === "gallery") return "gallery";
  if (data.component === "datedList") return "dated";
  if (data.component === "peopleGrid") return "people";
  if (data.component === "linkCluster") return "links";
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
  return `${kindField(state)}
    ${idField(state)}
    ${state.kind === "gallery" ? `${carryPictures(state.gallery)}${carryLook(state.gallery)}` : kindBody(state, choices)}
    ${formErrorPanel()}
    <p><button type="submit" class="w3-button w3-theme">${state.kind === "gallery" ? "Next" : "Create binding"}</button></p>`;
}

/**
 * Read the new-binding form. `folderIds` is the checklist when it is on the page;
 * otherwise folders travel in hidden `gallery-folder` inputs.
 */
export function readNewBinding(controls: readonly ControlValue[], folderIds?: readonly string[]): NewBinding {
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
  };
}

export function newBindingRecord(state: NewBinding): Record<string, unknown> {
  const id = state.id.trim();
  if (state.kind === "gallery") return galleryRecord(id, state.gallery);
  if (state.kind === "dated") return datedRecord(id, state.dated);
  if (state.kind === "people") return peopleRecord(id, state.people);
  if (state.kind === "links") return linksRecord(id, state.links);
  return { id, component: state.component.trim() };
}

export function newBindingError(state: NewBinding, existingIds: readonly string[]): string | undefined {
  const idProblem = bindingIdError(state.id, existingIds);
  if (idProblem) return idProblem;
  if (state.kind === "dated") return limitError(state.dated.limit);
  if (state.kind === "people") return limitError(state.people.limit);
  if (state.kind === "links" && state.links.source === "type" && !state.links.type.trim()) return "Choose a type.";
  if (state.kind === "links" && state.links.source === "nav" && !state.links.heading.trim()) return "Enter a menu heading.";
  if (state.kind === "other" && !state.component.trim()) return "Enter a component name.";
  return undefined;
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
      <p><button type="button" class="w3-button w3-white" data-binding-step="back">Back</button>
        <button type="submit" class="w3-button w3-theme">Next</button></p>`;
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
    <p><button type="button" class="w3-button w3-white" data-binding-step="back">Back</button>
      <button type="submit" class="w3-button w3-theme">Create binding</button></p>`;
}

function kindField(state: NewBinding): string {
  const kinds: { value: BindingKind; label: string }[] = [
    { value: "gallery", label: "Gallery" },
    { value: "dated", label: "Dated list" },
    { value: "people", label: "People grid" },
    { value: "links", label: "Link group" },
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
    <p class="w3-text-grey">${kindNote(state.kind)}</p>`;
}

function kindNote(kind: BindingKind): string {
  if (kind === "gallery") {
    return "A named gallery you can drop on many pages. A Gallery section in Compose stays on that one page. Next you choose the folders, then how it looks.";
  }
  if (kind === "dated") return "Pages of a type that have a date field.";
  if (kind === "people") return "Pages of a type, using the photo and role fields.";
  if (kind === "links") return "A titled set of links. Children follow the page the insert sits on.";
  return "You edit this as the raw file.";
}

function idField(state: NewBinding): string {
  const token = state.id.trim() || "id";
  return `<p><label for="new-binding-id">Id</label>
      <input id="new-binding-id" name="binding-id" class="w3-input w3-border w3-margin-top" required autocomplete="off" spellcheck="false" data-binding-focus value="${escapeHtml(state.id)}" /></p>
    <p class="w3-text-grey">Pages insert this as <code data-binding-token>{{${escapeHtml(token)}}}</code>. One file, <code>records/bindings/&lt;id&gt;.yaml</code>.</p>`;
}

function kindBody(state: NewBinding, choices: BindingChoices): string {
  if (state.kind === "dated") return datedFields(state.dated, choices.types);
  if (state.kind === "people") return peopleFields(state.people, choices.types);
  if (state.kind === "links") return linksFields(state.links, choices);
  return `<div class="editor-props"><p><label for="new-binding-component">Component</label>
    <input id="new-binding-component" name="binding-component" class="w3-input w3-border" spellcheck="false" autocomplete="off" value="${escapeHtml(state.component)}" /></p>
    <p class="editor-prop-wide w3-text-grey">The catalogue name, such as <code>eventList</code>.</p></div>`;
}

function galleryIntro(): string {
  return `<p class="w3-text-grey">A named gallery you can drop on any page. A Gallery section in Compose stays on that one page.</p>`;
}

function insertLine(id: string): string {
  return `<p>Put it on a page with Compose → Insert. The token is <code>{{${escapeHtml(id)}}}</code>.</p>`;
}

function pictureFields(draft: GalleryDraft, folders: readonly { id: string }[], focusFilter = false): string {
  const listed = listedFolders(draft.folders, folders);
  const checks = listed.length
    ? folderChecklist(listed, draft.folders)
    : `<p class="editor-prop-wide w3-text-grey">The library has no folders yet.</p>`;
  return `<div class="editor-props">${checks}
    <p><label for="gallery-filter">Only filenames matching</label>
      <input id="gallery-filter" name="gallery-filter" class="w3-input w3-border" spellcheck="false" placeholder="2024" value="${escapeHtml(draft.filter)}"${focusFilter ? " data-binding-focus" : ""} /></p>
    <p class="editor-prop-wide w3-text-grey">A pattern. 2024 keeps filenames that contain 2024.</p></div>`;
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
    <p class="editor-prop-wide w3-text-grey">Only pages with a date field are listed. Precis is the line under the date.</p>
    <p><label for="dated-when">When</label>
      <select id="dated-when" name="dated-when" class="w3-select w3-border">
        <option value="upcoming"${draft.when === "upcoming" ? " selected" : ""}>Upcoming</option>
        <option value="past"${draft.when === "past" ? " selected" : ""}>Past</option>
        <option value="all"${draft.when === "all" ? " selected" : ""}>All</option>
      </select></p>
    <p><label for="dated-limit">Limit</label>
      <input id="dated-limit" name="dated-limit" class="w3-input w3-border" inputmode="numeric" value="${escapeHtml(draft.limit)}" /></p>
    <p class="editor-prop-wide w3-text-grey">Leave blank to list every matching page.</p>
    <p><label for="dated-empty">Empty message</label>
      <input id="dated-empty" name="dated-empty" class="w3-input w3-border" value="${escapeHtml(draft.empty)}" /></p>
    <p class="editor-prop-wide w3-text-grey">Shown when nothing matches. Leave blank for the usual line.</p></div>`;
}

function peopleFields(draft: PeopleDraft, types: readonly string[]): string {
  return `<fieldset class="editor-fieldset"><legend>Types</legend>
      <div class="editor-props">${typeChecklist("people-type", draft.types, types)}</div>
    </fieldset>
    <div class="editor-props">
    <p class="editor-prop-wide w3-text-grey">Each page uses its photo and role fields. Leave every type unticked to list person pages.</p>
    <p><label for="people-limit">Limit</label>
      <input id="people-limit" name="people-limit" class="w3-input w3-border" inputmode="numeric" value="${escapeHtml(draft.limit)}" /></p>
    <p class="editor-prop-wide w3-text-grey">Leave blank to list every matching page.</p></div>`;
}

function linksFields(draft: LinksDraft, choices: BindingChoices): string {
  return `<div class="editor-props"><p class="editor-prop-wide w3-text-grey">Children follow the page the insert sits on.</p>
    <p><label for="links-title">Title</label>
      <input id="links-title" name="links-title" class="w3-input w3-border" value="${escapeHtml(draft.title)}" /></p>
    <p class="editor-prop-wide w3-text-grey">Leave blank and the list has no heading of its own.</p>
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
  if (!ids.length) return `<p class="editor-prop-wide w3-text-grey">This site has no types yet. Create one under Records → Types.</p>`;
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
  if (value === "gallery" || value === "dated" || value === "people" || value === "links" || value === "other") return value;
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
