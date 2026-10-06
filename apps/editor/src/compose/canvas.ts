import {
  PALETTE,
  PALETTE_TONES,
  blankSection,
  paintSections,
  parseSections,
  toneClass,
  toneLabel,
  youtubeVideoId,
  type PaletteKind,
  type Section,
  type ToneId,
} from "@r-a-i-t-h/tessera-sections";
import { setDragGhost } from "../drag-ghost.js";

export type BindingChoice = { id: string; title?: string };
export type FolderChoice = { id: string };

type Choices = { bindings: BindingChoice[]; folders: FolderChoice[] };

type EditColumns = {
  uid: string;
  kind: "columns";
  cells: { className: string; items: EditNode[] }[];
};

type EditLeaf = { uid: string } & Exclude<Section, { kind: "columns" }>;
type EditNode = EditLeaf | EditColumns;

type ZoneState = {
  name: string;
  host: HTMLElement;
  items: EditNode[];
};

type Mounted = {
  zones: ZoneState[];
  bindings: BindingChoice[];
  folders: FolderChoice[];
  active: string;
  locked: boolean;
  onEdit?: (burstId?: string) => void;
};

const mounted = new WeakMap<HTMLElement, Mounted>();
let uidCounter = 0;
let suppressClick = false;

function nextId(): string {
  uidCounter += 1;
  return `s${uidCounter}`;
}

export function mountComposeCanvases(
  form: HTMLFormElement,
  options: {
    bindings: BindingChoice[];
    folders?: FolderChoice[];
    htmlByZone: Record<string, string>;
    locked?: boolean;
    onEdit?: (burstId?: string) => void;
  },
): void {
  const zones: ZoneState[] = [];
  for (const host of form.querySelectorAll<HTMLElement>("[data-canvas]")) {
    const name = host.dataset.zone ?? "";
    zones.push({
      name,
      host,
      items: parseSections(options.htmlByZone[name] ?? "").map(toEdit),
    });
  }
  const state: Mounted = {
    zones,
    bindings: options.bindings,
    folders: options.folders ?? [],
    active: zones.find((zone) => zone.name === "main")?.name ?? zones[0]?.name ?? "",
    locked: options.locked === true,
    onEdit: options.onEdit,
  };
  mounted.set(form, state);
  for (const zone of zones) renderZone(form, zone);

  form.addEventListener("pointerdown", (event) => {
    const canvas = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-canvas]");
    if (canvas?.dataset.zone) state.active = canvas.dataset.zone;
  });
  form.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.dataset.field !== "heading") return;
    if (event.key === "Enter") event.preventDefault();
  });
  form.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.dataset.blocks !== "true") return;
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      // The editing host may not implement paragraph separators.
    }
  });
  form.addEventListener("input", (event) => onField(form, event.target, false));
  form.addEventListener("change", (event) => onField(form, event.target, true));
  form.addEventListener("click", (event) => onClick(form, event));
  form.addEventListener("mousedown", (event) => {
    if ((event.target as HTMLElement | null)?.closest("[data-cmd]")) event.preventDefault();
  });
  form.addEventListener("paste", (event) => onPaste(event));
  form.addEventListener("dragstart", (event) => onDragStart(form, event));
  form.addEventListener("dragover", (event) => onDragOver(form, event));
  form.addEventListener("drop", (event) => onDrop(form, event));
  form.addEventListener("dragend", () => {
    clearDrop(form);
    window.setTimeout(() => {
      suppressClick = false;
    }, 0);
  });
}

export function readComposeHtml(form: HTMLElement): Record<string, string> {
  const state = mounted.get(form);
  if (!state) return {};
  syncAll(state);
  const html: Record<string, string> = {};
  for (const zone of state.zones) html[zone.name] = paintSections(zone.items.map(toSection));
  return html;
}

function mark(form: HTMLElement): void {
  form.dataset.dirty = "true";
}

function notifyStructure(form: HTMLFormElement): void {
  mounted.get(form)?.onEdit?.();
}

function notifyField(form: HTMLFormElement, target: HTMLElement, fromChange: boolean): void {
  const field = target.dataset.field;
  const uid = target.closest<HTMLElement>("[data-item-id]")?.dataset.itemId;
  const text =
    target.isContentEditable ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement && target.type !== "checkbox" && target.type !== "radio");
  if (!text && !fromChange) return;
  const burst = text && field && uid ? `${uid}:${field}` : undefined;
  mounted.get(form)?.onEdit?.(burst);
}

function toEdit(section: Section): EditNode {
  if (section.kind === "columns") {
    return {
      uid: nextId(),
      kind: "columns",
      cells: section.cells.map((cell) => ({
        className: cell.className,
        items: cell.sections.map(toEdit),
      })),
    };
  }
  return { uid: nextId(), ...section };
}

function toSection(node: EditNode): Section {
  if (node.kind === "columns") {
    return {
      kind: "columns",
      cells: node.cells.map((cell) => ({
        className: cell.className,
        sections: cell.items.map(toSection),
      })),
    };
  }
  const { uid: _uid, ...section } = node;
  return section;
}

function renderZone(form: HTMLElement, zone: ZoneState): void {
  const state = mounted.get(form);
  if (!state) return;
  const empty = zone.items.length
    ? ""
    : `<p class="editor-canvas-empty w3-text-grey">${state.locked ? "This section is empty." : "Drag a section here, or choose one from the list."}</p>`;
  const body = zone.items.length
    ? state.locked
      ? zone.items.map((item) => renderItem(item, choicesFor(zone.host), zone.name, true)).join("")
      : itemsWithDrops(zone)
    : state.locked
      ? ""
      : dropSlot(zone.name, 0);
  zone.host.innerHTML = `${empty}${body}`;
}

function itemsWithDrops(zone: ZoneState): string {
  const parts: string[] = [dropSlot(zone.name, 0)];
  zone.items.forEach((item, index) => {
    parts.push(renderItem(item, choicesFor(zone.host), zone.name, false));
    parts.push(dropSlot(zone.name, index + 1));
  });
  return parts.join("");
}

function choicesFor(host: HTMLElement): Choices {
  const form = host.closest("form");
  const state = form ? mounted.get(form) : undefined;
  return { bindings: state?.bindings ?? [], folders: state?.folders ?? [] };
}

function renderItem(node: EditNode, choices: Choices, zone: string, locked: boolean): string {
  const move = locked
    ? ""
    : `<span class="editor-handle" draggable="true" data-drag title="Drag to move">Drag</span>`;
  const remove = locked ? "" : `<button type="button" class="w3-button w3-small w3-white" data-remove>Remove</button>`;
  return `<article class="editor-section" data-item-id="${node.uid}" data-zone="${escapeAttr(zone)}">
    <div class="editor-section-bar">
      ${move}
      <span class="editor-section-kind">${escapeText(labelFor(node))}</span>
      ${propsFor(node, choices, locked)}
      ${remove}
    </div>
    <div class="editor-section-body">${bodyFor(node, choices, zone, locked)}</div>
  </article>`;
}

function labelFor(node: EditNode): string {
  switch (node.kind) {
    case "heading":
      return "Heading";
    case "text":
      return "Text";
    case "panel":
      return "Panel";
    case "quote":
      return "Quote";
    case "imgbox":
      return "Image box";
    case "card":
      return "Card";
    case "columns":
      return "Side by side";
    case "insert":
      return "Insert";
    case "subpages":
      return "Subpages";
    case "youtube":
      return "YouTube";
    case "gallery":
      return "Gallery";
    case "pasted":
      return "Pasted note";
    case "html":
      return "Custom HTML";
  }
}

function propsFor(node: EditNode, choices: Choices, locked: boolean): string {
  if (locked) return lockedProps(node, choices);
  switch (node.kind) {
    case "heading":
      return levelSelect(node.level);
    case "text":
      return `${levelSelect(node.level)}<span class="editor-prop">${inlineTools()}${listTools()}</span>`;
    case "panel":
      return `<label class="editor-prop">Tone <select data-field="tone">${toneOptions(node.tone)}</select></label>${inlineTools()}`;
    case "quote":
      return `<label class="editor-prop">Tone <select data-field="tone">${toneOptions(node.tone)}</select></label><label class="editor-prop">Attribution <input data-field="attribution" class="w3-input" value="${escapeAttr(node.attribution)}"></label>`;
    case "imgbox":
      return `<label class="editor-prop">Image <input data-field="src" class="w3-input" value="${escapeAttr(node.src)}" placeholder="Image address"></label><button type="button" class="w3-button w3-small w3-white" data-library="image">Library</button><label class="editor-prop">Alt <input data-field="alt" class="w3-input" value="${escapeAttr(node.alt)}"></label><label class="editor-prop">Caption <input data-field="caption" class="w3-input" value="${escapeAttr(node.caption)}"></label>`;
    case "card":
      return `<label class="editor-prop">Title <input data-field="title" class="w3-input" value="${escapeAttr(node.title)}"></label>${inlineTools()}`;
    case "columns":
      return `<span class="editor-prop"><button type="button" class="w3-button w3-small w3-white" data-cols="2">2 columns</button><button type="button" class="w3-button w3-small w3-white" data-cols="3">3 columns</button></span>`;
    case "insert":
      return choices.bindings.length
        ? `<label class="editor-prop">Binding <select data-field="id">${bindingOptions(choices.bindings, node.id)}</select></label>`
        : `<label class="editor-prop">Binding id <input data-field="id" class="w3-input" value="${escapeAttr(node.id)}" placeholder="Binding id"></label>`;
    case "subpages":
      return `<label class="editor-prop">Heading <input data-field="title" class="w3-input" value="${escapeAttr(node.title)}" placeholder="Optional"></label>`;
    case "youtube":
      return `<label class="editor-prop">Video <input data-field="video" class="w3-input" value="${escapeAttr(node.videoId)}" placeholder="YouTube address or id"></label><label class="editor-prop">Title <input data-field="title" class="w3-input" value="${escapeAttr(node.title)}" placeholder="What the video shows"></label>`;
    case "gallery":
      return `<label class="editor-prop">Folder <select data-field="folder">${folderOptions(choices.folders, node.folder)}</select></label><label class="editor-prop">Layout <select data-field="mode"><option value="grid"${node.mode === "grid" ? " selected" : ""}>Grid</option><option value="slides"${node.mode === "slides" ? " selected" : ""}>Slides</option></select></label>`;
    case "pasted":
      return inlineTools();
    case "html":
      return `<span class="editor-prop w3-text-grey">Edit this markup on Fields.</span>`;
  }
}

function lockedProps(node: EditNode, choices: Choices): string {
  switch (node.kind) {
    case "text":
    case "panel":
    case "pasted":
      return node.kind === "text" ? `${inlineTools()}${listTools()}` : inlineTools();
    case "quote":
      return `<label class="editor-prop">Attribution <input data-field="attribution" class="w3-input" value="${escapeAttr(node.attribution)}"></label>`;
    case "imgbox":
      return `<label class="editor-prop">Image <input data-field="src" class="w3-input" value="${escapeAttr(node.src)}" placeholder="Image address"></label><button type="button" class="w3-button w3-small w3-white" data-library="image">Library</button><label class="editor-prop">Alt <input data-field="alt" class="w3-input" value="${escapeAttr(node.alt)}"></label><label class="editor-prop">Caption <input data-field="caption" class="w3-input" value="${escapeAttr(node.caption)}"></label>`;
    case "card":
      return `<label class="editor-prop">Title <input data-field="title" class="w3-input" value="${escapeAttr(node.title)}"></label>${inlineTools()}`;
    case "gallery":
      return `<label class="editor-prop">Folder <select data-field="folder">${folderOptions(choices.folders, node.folder)}</select></label>`;
    case "youtube":
      return `<label class="editor-prop">Video <input data-field="video" class="w3-input" value="${escapeAttr(node.videoId)}" placeholder="YouTube address or id"></label><label class="editor-prop">Title <input data-field="title" class="w3-input" value="${escapeAttr(node.title)}" placeholder="What the video shows"></label>`;
    case "subpages":
      return `<label class="editor-prop">Heading <input data-field="title" class="w3-input" value="${escapeAttr(node.title)}" placeholder="Optional"></label>`;
    default:
      return "";
  }
}

function headingLevel(value: string): 1 | 2 | 3 {
  const level = Number(value);
  return level === 1 ? 1 : level === 3 ? 3 : 2;
}

function retagHeading(article: HTMLElement, level: 1 | 2 | 3, field: "heading" | "text"): void {
  const current = article.querySelector<HTMLElement>(`[data-field="${field}"]`);
  if (!current || current.tagName === `H${level}`) return;
  const next = document.createElement(`h${level}`);
  for (const attr of current.attributes) next.setAttribute(attr.name, attr.value);
  next.innerHTML = current.innerHTML;
  current.replaceWith(next);
}

function levelSelect(level: 1 | 2 | 3): string {
  return `<label class="editor-prop">Level <select data-field="level">${[1, 2, 3]
    .map((item) => `<option value="${item}"${level === item ? " selected" : ""}>${item}</option>`)
    .join("")}</select></label>`;
}

function inlineTools(): string {
  return `<span class="editor-inline">${[
    markButton("bold", "Bold", "<b>B</b>"),
    markButton("italic", "Italic", "<i>I</i>"),
    markButton("underline", "Underline", "<u>U</u>"),
    markButton("strikeThrough", "Strikethrough", "<s>S</s>"),
    markButton("code", "Code", `<span class="editor-mark-code">&lt;/&gt;</span>`),
    markGap(),
    markButton("link", "Link", LINK_ICON),
    markButton("removeFormat", "Clear formatting", CLEAR_ICON),
  ].join("")}</span>`;
}

function listTools(): string {
  return `<span class="editor-inline">${[
    markButton("insertUnorderedList", "Bulleted list", LIST_ICON),
    markButton("insertOrderedList", "Numbered list", NUMBER_ICON),
    markGap(),
    markButton("align:w3-left-align", "Align left", ALIGN_LEFT_ICON),
    markButton("align:w3-center", "Align center", ALIGN_CENTER_ICON),
    markButton("align:w3-right-align", "Align right", ALIGN_RIGHT_ICON),
    markButton("align:w3-justify", "Justify", ALIGN_JUSTIFY_ICON),
  ].join("")}</span>`;
}

function markButton(cmd: string, label: string, glyph: string): string {
  return `<button type="button" class="editor-mark" data-cmd="${cmd}" aria-label="${escapeAttr(label)}" title="${escapeAttr(label)}">${glyph}</button>`;
}

function markGap(): string {
  return `<span class="editor-mark-gap" aria-hidden="true"></span>`;
}

const LINK_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M6.8 9.2 9.2 6.8"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M7.2 4.5 8.3 3.4a2.2 2.2 0 0 1 3.1 3.1L10.3 7.6M8.8 11.5 7.7 12.6a2.2 2.2 0 0 1-3.1-3.1L5.7 8.4"/></svg>`;
const CLEAR_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" d="m3.4 10.2 4.8-6.4 4.4 3.3-4.8 6.4H5.2z"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M8.2 13.4h5"/></svg>`;
const LIST_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="4" r="1.05" fill="currentColor"/><circle cx="3" cy="8" r="1.05" fill="currentColor"/><circle cx="3" cy="12" r="1.05" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M6 4h7.2M6 8h7.2M6 12h7.2"/></svg>`;
const NUMBER_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><text x="0.4" y="5" font-size="4.6" font-family="ui-sans-serif, system-ui, sans-serif" fill="currentColor">1</text><text x="0.4" y="9.3" font-size="4.6" font-family="ui-sans-serif, system-ui, sans-serif" fill="currentColor">2</text><text x="0.4" y="13.6" font-size="4.6" font-family="ui-sans-serif, system-ui, sans-serif" fill="currentColor">3</text><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M6 3.6h7.2M6 7.9h7.2M6 12.2h7.2"/></svg>`;
const ALIGN_LEFT_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M2.5 3.5h11M2.5 7h7M2.5 10.5h11M2.5 14h5"/></svg>`;
const ALIGN_CENTER_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M2.5 3.5h11M4.5 7h7M2.5 10.5h11M5.5 14h5"/></svg>`;
const ALIGN_RIGHT_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M2.5 3.5h11M6.5 7h7M2.5 10.5h11M8.5 14h5"/></svg>`;
const ALIGN_JUSTIFY_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M2.5 3.5h11M2.5 7h11M2.5 10.5h11M2.5 14h11"/></svg>`;

function bodyFor(node: EditNode, choices: Choices, zone: string, locked: boolean): string {
  switch (node.kind) {
    case "heading":
      return `<h${node.level} contenteditable="true" data-field="text" data-plain="true" data-placeholder="Heading">${escapeText(node.text)}</h${node.level}>`;
    case "text":
      return `<div class="editor-text"><h${node.level} contenteditable="true" data-field="heading" data-plain="true" data-placeholder="Heading">${escapeText(node.heading)}</h${node.level}><div class="editor-text-body" contenteditable="true" data-field="html" data-blocks="true" data-placeholder="Write…">${node.html}</div></div>`;
    case "panel":
      return `<div class="${joinClass("w3-panel", "w3-padding", toneClass(node.tone))}"><div contenteditable="true" data-field="html" data-placeholder="Panel">${node.html}</div></div>`;
    case "quote":
      return quoteBody(node);
    case "imgbox":
      return imgboxBody(node);
    case "card":
      return `<div class="w3-card w3-padding w3-margin-bottom w3-white"><h3 class="w3-text-theme" data-card-title>${escapeText(node.title)}</h3><div class="rt-card-body" contenteditable="true" data-field="html" data-placeholder="Card">${node.html}</div></div>`;
    case "columns":
      return columnsBody(node, choices, zone, locked);
    case "insert": {
      const title = choices.bindings.find((binding) => binding.id === node.id)?.title;
      const name = node.id ? (title && title !== node.id ? `${title} (${node.id})` : node.id) : "Choose a binding";
      return `<p class="w3-panel w3-pale-yellow">Insert: ${escapeText(name)}</p>`;
    }
    case "subpages":
      return `<p class="w3-panel w3-pale-blue">Subpages${node.title ? `: ${escapeText(node.title)}` : ""}. The published page lists this page's children.</p>`;
    case "youtube":
      return youtubeBody(node);
    case "gallery": {
      const name = node.folder || "Choose a folder";
      return `<p class="w3-panel w3-pale-yellow">Gallery: ${escapeText(name)} (${node.mode === "slides" ? "slides" : "grid"})</p>`;
    }
    case "pasted":
      return `<div class="tessera-pasted"><div class="tessera-pasted-sheet"><div contenteditable="true" data-field="html" data-placeholder="Write on the paper…">${node.html}</div></div></div>`;
    case "html":
      return `<div class="editor-html-preview">${node.html}</div>`;
  }
}

function youtubeBody(node: Extract<EditLeaf, { kind: "youtube" }>): string {
  const id = youtubeVideoId(node.videoId);
  if (!id) return `<p class="w3-text-grey">Add a YouTube address.</p>`;
  return `<div class="tessera-video w3-card"><iframe src="https://www.youtube-nocookie.com/embed/${escapeAttr(id)}" title="${escapeAttr(node.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
}

function quoteBody(node: Extract<EditLeaf, { kind: "quote" }>): string {
  const close = node.attribution
    ? `<p class="w3-right-align" data-quote-by>${escapeText(node.attribution)}</p>`
    : `<p class="w3-right-align" data-quote-by><i class="fa fa-quote-right w3-xlarge w3-text-black w3-opacity-max"></i></p>`;
  return `<div class="w3-content w3-padding-16" style="max-width: 70%"><div class="${joinClass("w3-panel", "w3-card-4", "w3-round-large", toneClass(node.tone))}"><p class="w3-left-align"><i class="fa fa-quote-left w3-xlarge w3-text-black w3-opacity-max"></i></p><p class="w3-xlarge w3-serif w3-center" contenteditable="true" data-field="text" data-plain="true" data-placeholder="Quote">${escapeText(node.text)}</p>${close}</div></div>`;
}

function imgboxBody(node: Extract<EditLeaf, { kind: "imgbox" }>): string {
  const caption = node.caption
    ? `<div class="w3-display-middle w3-container w3-padding-16 w3-round-large w3-white" data-caption>${escapeText(node.caption)}</div>`
    : `<div class="w3-display-middle w3-hide" data-caption></div>`;
  const src = node.src || "";
  return `<div class="tessera-imgbox w3-display-container w3-container w3-padding-16 w3-card w3-center">${src ? `<img src="${escapeAttr(src)}" class="w3-image" alt="${escapeAttr(node.alt)}">` : `<p class="w3-text-grey">Add an image address.</p>`}${caption}</div>`;
}

function columnsBody(node: EditColumns, choices: Choices, zone: string, locked: boolean): string {
  const layout = node.cells.length === 3 ? "w3-third" : "w3-half";
  const cells = node.cells
    .map((cell, index) => {
      const inner = locked
        ? cell.items.map((item) => renderItem(item, choices, zone, true)).join("")
        : cell.items.length
          ? cell.items.map((item, itemIndex) => `${itemIndex === 0 ? dropSlot(zone, 0, node.uid, index) : ""}${renderItem(item, choices, zone, false)}${dropSlot(zone, itemIndex + 1, node.uid, index)}`).join("")
          : dropSlot(zone, 0, node.uid, index);
      return `<div class="${joinClass(layout, cell.className)} editor-cell">${inner}</div>`;
    })
    .join("");
  return `<div class="w3-row-padding w3-stretch">${cells}</div>`;
}

function resolveSlot(target: EventTarget | null, form: HTMLFormElement): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  const direct = target.closest<HTMLElement>("[data-drop]");
  if (direct && form.contains(direct)) return direct;
  const article = target.closest<HTMLElement>("[data-item-id]");
  if (article && form.contains(article)) {
    const next = article.nextElementSibling;
    if (next instanceof HTMLElement && next.matches("[data-drop]")) return next;
  }
  const canvas = target.closest<HTMLElement>("[data-canvas]");
  if (!canvas || !form.contains(canvas)) return null;
  const slots = canvas.querySelectorAll<HTMLElement>(":scope > [data-drop]");
  return slots[slots.length - 1] ?? canvas.querySelector<HTMLElement>("[data-drop]");
}

function dropSlot(zone: string, index: number, parent = "", cell: string | number = ""): string {
  return `<div class="editor-drop-line" data-drop data-drop-zone="${escapeAttr(zone)}" data-drop-index="${index}" data-drop-parent="${escapeAttr(parent)}" data-drop-cell="${escapeAttr(String(cell))}"></div>`;
}

function onField(form: HTMLFormElement, target: EventTarget | null, fromChange: boolean): void {
  if (!(target instanceof HTMLElement)) return;
  const field = target.dataset.field;
  if (!field) return;
  const state = mounted.get(form);
  if (!state) return;
  const article = target.closest<HTMLElement>("[data-item-id]");
  const node = article ? findNode(allItems(state), article.dataset.itemId ?? "") : undefined;
  if (!node || node.kind === "columns") return;
  if (state.locked && isDesignField(node.kind, field)) return;
  mark(form);
  try {
    if (field === "html" && target.isContentEditable && node.kind === "text") {
      node.html = readTextHtml(target.innerHTML);
      return;
    }
    if (field === "html" && target.isContentEditable && (node.kind === "panel" || node.kind === "card" || node.kind === "pasted")) {
      node.html = sanitize(target.innerHTML);
      return;
    }
    if (field === "heading" && target.isContentEditable && node.kind === "text") {
      node.heading = (target.textContent ?? "").replace(/\n+/g, " ");
      return;
    }
    if (field === "text" && target.isContentEditable) {
      if (node.kind === "heading" || node.kind === "quote") node.text = target.textContent ?? "";
      return;
    }
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    const value = target.value;
    if ((node.kind === "heading" || node.kind === "text") && field === "level") {
      node.level = headingLevel(value);
      if (fromChange && article) retagHeading(article, node.level, node.kind === "text" ? "heading" : "text");
      return;
    }
    if ((node.kind === "panel" || node.kind === "quote") && field === "tone") {
      node.tone = isTone(value) ? value : "plain";
      if (fromChange) rerenderArticle(form, node.uid);
      return;
    }
    if (node.kind === "quote" && field === "attribution") {
      const had = node.attribution;
      node.attribution = value;
      if (!had !== !value) rerenderArticle(form, node.uid);
      else article?.querySelector("[data-quote-by]")?.replaceChildren(document.createTextNode(value));
      return;
    }
    if (node.kind === "imgbox") {
      if (field === "src") node.src = value;
      if (field === "alt") node.alt = value;
      if (field === "caption") node.caption = value;
      if (fromChange) rerenderArticle(form, node.uid);
      return;
    }
    if (node.kind === "card" && field === "title") {
      node.title = value;
      const title = article?.querySelector("[data-card-title]");
      if (title) title.textContent = value;
      return;
    }
    if (node.kind === "insert" && field === "id") {
      node.id = value.trim();
      if (fromChange) rerenderArticle(form, node.uid);
      return;
    }
    if (node.kind === "subpages" && field === "title") {
      node.title = value;
      if (fromChange) rerenderArticle(form, node.uid);
      return;
    }
    if (node.kind === "youtube" && field === "video") {
      const id = youtubeVideoId(value);
      node.videoId = id || value.trim();
      if (fromChange && id) rerenderArticle(form, node.uid);
      return;
    }
    if (node.kind === "youtube" && field === "title") {
      node.title = value;
      if (fromChange) rerenderArticle(form, node.uid);
      return;
    }
    if (node.kind === "gallery" && field === "folder") {
      node.folder = value;
      if (fromChange) rerenderArticle(form, node.uid);
      return;
    }
    if (node.kind === "gallery" && field === "mode") {
      node.mode = value === "slides" ? "slides" : "grid";
      if (fromChange) rerenderArticle(form, node.uid);
    }
  } finally {
    notifyField(form, target, fromChange);
  }
}

function isDesignField(kind: EditNode["kind"], field: string): boolean {
  if (field === "level" || field === "tone" || field === "mode") return true;
  return kind === "insert" && field === "id";
}

function onClick(form: HTMLFormElement, event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const state = mounted.get(form);
  if (!state) return;
  const palette = target.closest<HTMLElement>("[data-palette]");
  if (palette?.dataset.palette) {
    event.preventDefault();
    if (state.locked || suppressClick) return;
    appendPalette(form, palette.dataset.palette);
    return;
  }
  const command = target.closest<HTMLElement>("[data-cmd]");
  if (command?.dataset.cmd) {
    event.preventDefault();
    runCommand(form, command.dataset.cmd);
    return;
  }
  const cols = target.closest<HTMLElement>("[data-cols]");
  if (cols?.dataset.cols) {
    event.preventDefault();
    if (state.locked) return;
    setColumns(form, cols);
    return;
  }
  const remove = target.closest<HTMLElement>("[data-remove]");
  if (remove) {
    event.preventDefault();
    if (state.locked) return;
    const article = remove.closest<HTMLElement>("[data-item-id]");
    const uid = article?.dataset.itemId;
    if (!uid) return;
    mark(form);
    for (const zone of state.zones) {
      if (removeNode(zone.items, uid)) renderZone(form, zone);
    }
    notifyStructure(form);
  }
}

function appendPalette(form: HTMLFormElement, kind: string): void {
  const state = mounted.get(form);
  if (!state || state.locked || !isPaletteKind(kind)) return;
  const zone = state.zones.find((item) => item.name === state.active) ?? state.zones[0];
  if (!zone) return;
  if (kind === "columns" && insideCell()) return;
  mark(form);
  syncAll(state);
  zone.items.push(toEdit(blankSection(kind)));
  renderZone(form, zone);
  notifyStructure(form);
}

const ALIGN_CLASS = ["w3-left-align", "w3-right-align", "w3-center", "w3-text-center", "w3-justify"];

function runCommand(form: HTMLFormElement, command: string): void {
  mark(form);
  if (command.startsWith("align:")) {
    alignBlock(command.slice("align:".length));
    return;
  }
  if (command === "link") {
    const href = window.prompt("Link address");
    if (!href || /^\s*javascript:/i.test(href)) return;
    document.execCommand("createLink", false, href);
    touchEditable();
    return;
  }
  if (command === "code") {
    toggleCode();
    return;
  }
  if (command === "removeFormat") {
    document.execCommand("removeFormat");
    document.execCommand("unlink");
    clearAlign();
    unwrapTag("code");
    touchEditable();
    return;
  }
  if (command === "bold" || command === "italic" || command === "underline" || command === "strikeThrough") {
    document.execCommand(command);
    touchEditable();
    return;
  }
  if (command === "insertUnorderedList" || command === "insertOrderedList") {
    document.execCommand("defaultParagraphSeparator", false, "p");
    document.execCommand(command);
    touchEditable();
  }
}

function alignBlock(className: string): void {
  const block = currentBlock();
  if (!block) return;
  const on = block.classList.contains(className);
  for (const name of ALIGN_CLASS) block.classList.remove(name);
  if (!on) block.classList.add(className);
  touchEditable();
}

function clearAlign(): void {
  const block = currentBlock();
  if (!block) return;
  for (const name of ALIGN_CLASS) block.classList.remove(name);
}

function currentBlock(): HTMLElement | null {
  const sel = document.getSelection();
  const node = sel?.anchorNode;
  const el = node instanceof Element ? node : node?.parentElement;
  const editable = el?.closest<HTMLElement>("[contenteditable]");
  if (!editable || editable.dataset.blocks !== "true") return null;
  const block = el?.closest("p, ul, ol");
  return block instanceof HTMLElement && editable.contains(block) ? block : null;
}

function toggleCode(): void {
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const anchor = sel.anchorNode;
  const from = anchor instanceof Element ? anchor : anchor?.parentElement;
  const editable = from?.closest("[contenteditable]");
  const code = from?.closest("code");
  if (code && editable?.contains(code)) {
    code.replaceWith(document.createTextNode(code.textContent ?? ""));
    touchEditable();
    return;
  }
  const text = sel.toString();
  if (!text) return;
  document.execCommand("insertHTML", false, `<code>${escapeText(text)}</code>`);
  touchEditable();
}

function unwrapTag(tag: string): void {
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  const root = range.commonAncestorContainer;
  const scope = root instanceof Element ? root : root.parentElement;
  if (!scope) return;
  const hits = scope.tagName.toLowerCase() === tag ? [scope] : [...scope.querySelectorAll(tag)];
  for (const el of hits) {
    if (!range.intersectsNode(el) && !el.contains(range.startContainer)) continue;
    el.replaceWith(...el.childNodes);
  }
}

function touchEditable(): void {
  const sel = document.getSelection();
  const node = sel?.anchorNode;
  const el = node instanceof Element ? node : node?.parentElement;
  el?.closest("[contenteditable]")?.dispatchEvent(new Event("input", { bubbles: true }));
}

function setColumns(form: HTMLFormElement, button: HTMLElement): void {
  const state = mounted.get(form);
  if (state?.locked) return;
  const article = button.closest<HTMLElement>("[data-item-id]");
  const node = state && article ? findNode(allItems(state), article.dataset.itemId ?? "") : undefined;
  if (!state || !node || node.kind !== "columns") return;
  const count = button.dataset.cols === "3" ? 3 : 2;
  mark(form);
  syncAll(state);
  while (node.cells.length < count) node.cells.push({ className: "", items: [] });
  while (node.cells.length > count) {
    const removed = node.cells.pop();
    const kept = node.cells[node.cells.length - 1];
    if (removed && kept) kept.items.push(...removed.items);
  }
  const zone = zoneOf(state, node.uid);
  if (zone) renderZone(form, zone);
  notifyStructure(form);
}

function onPaste(event: ClipboardEvent): void {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.isContentEditable) return;
  event.preventDefault();
  if (target.dataset.plain === "true") {
    document.execCommand("insertText", false, event.clipboardData?.getData("text/plain") ?? "");
    return;
  }
  const html = event.clipboardData?.getData("text/html") ?? "";
  const text = event.clipboardData?.getData("text/plain") ?? "";
  if (target.dataset.blocks === "true") {
    const pasted = html ? readTextHtml(html) : paragraphsFromPlain(text);
    if (pasted) document.execCommand("insertHTML", false, pasted);
    return;
  }
  document.execCommand("insertHTML", false, html ? sanitize(html) : escapeText(text).replace(/\n/g, "<br>"));
}

function onDragStart(form: HTMLFormElement, event: DragEvent): void {
  if (mounted.get(form)?.locked) {
    event.preventDefault();
    return;
  }
  const target = event.target;
  if (!(target instanceof HTMLElement) || !event.dataTransfer) return;
  suppressClick = true;
  const palette = target.closest<HTMLElement>("[data-palette]");
  if (palette?.dataset.palette) {
    event.dataTransfer.setData("application/x-tessera-palette", palette.dataset.palette);
    event.dataTransfer.setData("text/plain", palette.dataset.palette);
    event.dataTransfer.effectAllowed = "copy";
    setDragGhost(event.dataTransfer, palette.textContent ?? "");
    return;
  }
  const handle = target.closest<HTMLElement>("[data-drag]");
  const article = handle?.closest<HTMLElement>("[data-item-id]");
  const zone = article?.dataset.zone;
  if (!handle || !article?.dataset.itemId || !zone) return;
  event.dataTransfer.setData("application/x-tessera-item", `${zone}\t${article.dataset.itemId}`);
  event.dataTransfer.setData("text/plain", article.dataset.itemId);
  event.dataTransfer.effectAllowed = "move";
  setDragGhost(event.dataTransfer, article.querySelector(".editor-section-kind")?.textContent ?? "");
  event.stopPropagation();
}

function onDragOver(form: HTMLFormElement, event: DragEvent): void {
  if (mounted.get(form)?.locked) return;
  const slot = resolveSlot(event.target, form);
  if (!slot) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  clearDrop(form);
  slot.classList.add("editor-drop-active");
}

function onDrop(form: HTMLFormElement, event: DragEvent): void {
  if (mounted.get(form)?.locked) return;
  const slot = resolveSlot(event.target, form);
  const state = mounted.get(form);
  if (!slot || !state || !event.dataTransfer) return;
  event.preventDefault();
  clearDrop(form);
  syncAll(state);
  const zoneName = slot.dataset.dropZone ?? "";
  const index = Number(slot.dataset.dropIndex ?? "0");
  const parent = slot.dataset.dropParent || "";
  const cell = Number(slot.dataset.dropCell || "0");
  const list = listFor(state, zoneName, parent, cell);
  if (!list) return;
  const palette = event.dataTransfer.getData("application/x-tessera-palette");
  if (palette) {
    if (!isPaletteKind(palette)) return;
    if (palette === "columns" && parent) return;
    list.splice(index, 0, toEdit(blankSection(palette)));
    mark(form);
    renderAll(form, state);
    notifyStructure(form);
    return;
  }
  const itemData = event.dataTransfer.getData("application/x-tessera-item");
  const uid = itemData.split("\t")[1];
  if (!uid || parent === uid) return;
  const moving = findNode(allItems(state), uid);
  if (parent && (isColumns(moving) || containsNode(moving, parent))) return;
  const from = locate(state, uid);
  if (!from) return;
  mark(form);
  const [moved] = from.list.splice(from.index, 1);
  if (!moved) return;
  const dest = from.list === list && from.index < index ? index - 1 : index;
  list.splice(Math.max(0, dest), 0, moved);
  renderAll(form, state);
  notifyStructure(form);
}

function listFor(state: Mounted, zoneName: string, parent: string, cell: number): EditNode[] | undefined {
  const zone = state.zones.find((item) => item.name === zoneName);
  if (!zone) return;
  if (!parent) return zone.items;
  const columns = findNode(zone.items, parent);
  if (!columns || columns.kind !== "columns") return;
  return columns.cells[cell]?.items;
}

function locate(state: Mounted, uid: string): { list: EditNode[]; index: number } | undefined {
  const search = (list: EditNode[]): { list: EditNode[]; index: number } | undefined => {
    const index = list.findIndex((item) => item.uid === uid);
    if (index >= 0) return { list, index };
    for (const item of list) {
      if (item.kind !== "columns") continue;
      for (const cell of item.cells) {
        const found = search(cell.items);
        if (found) return found;
      }
    }
    return;
  };
  for (const zone of state.zones) {
    const found = search(zone.items);
    if (found) return found;
  }
  return;
}

function removeNode(list: EditNode[], uid: string): boolean {
  const index = list.findIndex((item) => item.uid === uid);
  if (index >= 0) {
    list.splice(index, 1);
    return true;
  }
  for (const item of list) {
    if (item.kind === "columns" && item.cells.some((cell) => removeNode(cell.items, uid))) return true;
  }
  return false;
}

function findNode(list: EditNode[], uid: string): EditNode | undefined {
  for (const item of list) {
    if (item.uid === uid) return item;
    if (item.kind === "columns") {
      for (const cell of item.cells) {
        const found = findNode(cell.items, uid);
        if (found) return found;
      }
    }
  }
  return;
}

function containsNode(node: EditNode | undefined, uid: string): boolean {
  if (!node || node.kind !== "columns") return false;
  return node.cells.some((cell) => cell.items.some((item) => item.uid === uid || containsNode(item, uid)));
}

function isColumns(node: EditNode | undefined): boolean {
  return node?.kind === "columns";
}

function allItems(state: Mounted): EditNode[] {
  return state.zones.flatMap((zone) => zone.items);
}

function zoneOf(state: Mounted, uid: string): ZoneState | undefined {
  return state.zones.find((zone) => findNode(zone.items, uid));
}

function renderAll(form: HTMLFormElement, state: Mounted): void {
  for (const zone of state.zones) renderZone(form, zone);
}

function rerenderArticle(form: HTMLFormElement, uid: string): void {
  const state = mounted.get(form);
  if (!state) return;
  const zone = zoneOf(state, uid);
  if (zone) renderZone(form, zone);
}

function syncAll(state: Mounted): void {
  for (const zone of state.zones) {
    for (const field of zone.host.querySelectorAll<HTMLElement>("[data-field]")) {
      const article = field.closest<HTMLElement>("[data-item-id]");
      const node = article ? findNode(zone.items, article.dataset.itemId ?? "") : undefined;
      if (!node || node.kind === "columns") continue;
      if (field.dataset.field === "html" && field.isContentEditable && node.kind === "text") {
        node.html = readTextHtml(field.innerHTML);
      }
      if (field.dataset.field === "heading" && field.isContentEditable && node.kind === "text") {
        node.heading = (field.textContent ?? "").replace(/\n+/g, " ");
      }
      if (field.dataset.field === "html" && field.isContentEditable && (node.kind === "panel" || node.kind === "card" || node.kind === "pasted")) {
        node.html = sanitize(field.innerHTML);
      }
      if (field.dataset.field === "text" && field.isContentEditable && (node.kind === "heading" || node.kind === "quote")) {
        node.text = field.textContent ?? "";
      }
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
        applyControl(node, field.dataset.field ?? "", field.value);
      }
    }
  }
}

function applyControl(node: EditLeaf, field: string, value: string): void {
  if ((node.kind === "heading" || node.kind === "text") && field === "level") node.level = headingLevel(value);
  if ((node.kind === "panel" || node.kind === "quote") && field === "tone" && isTone(value)) node.tone = value;
  if (node.kind === "quote" && field === "attribution") node.attribution = value;
  if (node.kind === "imgbox" && field === "src") node.src = value;
  if (node.kind === "imgbox" && field === "alt") node.alt = value;
  if (node.kind === "imgbox" && field === "caption") node.caption = value;
  if (node.kind === "card" && field === "title") node.title = value;
  if (node.kind === "insert" && field === "id") node.id = value.trim();
  if (node.kind === "subpages" && field === "title") node.title = value;
  if (node.kind === "youtube" && field === "video") {
    const id = youtubeVideoId(value);
    node.videoId = id || value.trim();
  }
  if (node.kind === "youtube" && field === "title") node.title = value;
  if (node.kind === "gallery" && field === "folder") node.folder = value;
  if (node.kind === "gallery" && field === "mode") node.mode = value === "slides" ? "slides" : "grid";
}

function clearDrop(form: HTMLElement): void {
  for (const line of form.querySelectorAll(".editor-drop-active")) line.classList.remove("editor-drop-active");
}

function insideCell(): boolean {
  const selection = document.activeElement?.closest("[data-drop-parent]");
  return !!selection && !!selection.getAttribute("data-drop-parent");
}

function toneOptions(current: ToneId): string {
  const ids = PALETTE_TONES.includes(current) ? [...PALETTE_TONES] : [...PALETTE_TONES, current];
  return ids
    .map((id) => `<option value="${id}"${id === current ? " selected" : ""}>${escapeText(toneLabel(id))}</option>`)
    .join("");
}

function folderOptions(folders: FolderChoice[], current: string): string {
  const ids = folders.some((folder) => folder.id === current) || !current ? folders : [{ id: current }, ...folders];
  const options = [`<option value="">Choose…</option>`];
  for (const folder of ids) {
    const label = folder.id;
    options.push(`<option value="${escapeAttr(folder.id)}"${folder.id === current ? " selected" : ""}>${escapeText(label)}</option>`);
  }
  return options.join("");
}

function bindingOptions(bindings: BindingChoice[], current: string): string {
  const ids = bindings.some((binding) => binding.id === current) || !current ? bindings : [{ id: current }, ...bindings];
  const options = [`<option value="">Choose…</option>`];
  for (const binding of ids) {
    const label = binding.title && binding.title !== binding.id ? `${binding.title} (${binding.id})` : binding.id;
    options.push(`<option value="${escapeAttr(binding.id)}"${binding.id === current ? " selected" : ""}>${escapeText(label)}</option>`);
  }
  return options.join("");
}

function isPaletteKind(kind: string): kind is PaletteKind {
  return PALETTE.some((item) => item.kind === kind);
}

function isTone(value: string): value is ToneId {
  return (
    value === "plain" ||
    value === "sand" ||
    value === "pale" ||
    value === "pale-blue" ||
    value === "pale-green" ||
    value === "pale-red" ||
    value === "theme" ||
    value === "light-grey" ||
    value === "white" ||
    value === "orange" ||
    value === "teal"
  );
}

const ALLOWED = new Set(["strong", "b", "em", "i", "u", "s", "code", "a", "br", "ul", "ol", "li", "p"]);

function paragraphsFromPlain(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeText(part).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function readTextHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  return root ? blocksIn(root) : "";
}

function blocksIn(parent: Element): string {
  let out = "";
  let inline = "";
  const flush = () => {
    const cleaned = inline.trim();
    if (cleaned && cleaned !== "<br>") out += `<p>${cleaned}</p>`;
    inline = "";
  };
  for (const node of parent.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent ?? "").trim()) inline += escapeText(node.textContent ?? "");
      continue;
    }
    if (!(node instanceof Element)) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      flush();
      const items = [...node.children]
        .filter((child) => child.tagName.toLowerCase() === "li")
        .map((child) => `<li>${sanitize(child.innerHTML)}</li>`)
        .join("");
      if (items) out += `<${tagOpen(node, tag)}>${items}</${tag}>`;
      continue;
    }
    if (tag === "p" || tag === "div") {
      const nested =
        tag === "div" &&
        [...node.children].some((child) => {
          const name = child.tagName.toLowerCase();
          return name === "p" || name === "div" || name === "ul" || name === "ol";
        });
      if (nested) {
        flush();
        out += blocksIn(node);
        continue;
      }
      flush();
      const inner = sanitize(node.innerHTML);
      if (!inner.replace(/<br>/g, "").trim()) continue;
      const open = tag === "p" ? tagOpen(node, "p") : "p";
      out += `<${open}>${inner}</p>`;
      continue;
    }
    if (tag === "br") {
      inline += "<br>";
      continue;
    }
    inline += sanitize(node.outerHTML);
  }
  flush();
  return out;
}

function tagOpen(el: Element, tag: string): string {
  const className = el.getAttribute("class")?.trim() ?? "";
  return className ? `${tag} class="${escapeAttr(className)}"` : tag;
}

function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  return root ? cleanChildren(root) : "";
}

function cleanChildren(parent: Element): string {
  let out = "";
  for (const node of parent.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += escapeText(node.textContent ?? "");
      continue;
    }
    if (!(node instanceof Element)) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === "div") {
      if (out && !out.endsWith("<br>")) out += "<br>";
      out += cleanChildren(node);
      continue;
    }
    if (tag === "strike") {
      out += `<s>${cleanChildren(node)}</s>`;
      continue;
    }
    if (!ALLOWED.has(tag)) {
      out += cleanChildren(node);
      continue;
    }
    if (tag === "br") {
      out += "<br>";
      continue;
    }
    if (tag === "a") {
      const href = node.getAttribute("href") ?? "";
      if (!/^(https?:|mailto:|\/|#|\.)/i.test(href) || /^\s*javascript:/i.test(href)) {
        out += cleanChildren(node);
        continue;
      }
      out += `<a href="${escapeAttr(href)}">${cleanChildren(node)}</a>`;
      continue;
    }
    out += `<${tag}>${cleanChildren(node)}</${tag}>`;
  }
  return out;
}

function joinClass(...parts: string[]): string {
  return parts
    .flatMap((part) => part.split(/\s+/))
    .filter(Boolean)
    .join(" ");
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}
