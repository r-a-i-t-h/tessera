import {
  BLOCK_CLASS,
  BLOCK_WIDTHS,
  COLUMN_LAYOUTS,
  PALETTE,
  blankSection,
  cardClass,
  columnWidths,
  imgboxClass,
  isBlockWidth,
  isColumnLayout,
  paintSections,
  parseHeadingLevel,
  parseSections,
  paletteToneIds,
  quoteBlockHtml,
  renderMarkdownLinks,
  restoreMarkdownLinks,
  toneClass,
  toneLabel,
  youtubeVideoId,
  type BlockWidthId,
  type ColumnLayoutId,
  type HeadingLevel,
  type PaletteKind,
  type PanelToneDef,
  type Section,
  type ToneId,
} from "@r-a-i-t-h/tessera-sections";
import { setDragGhost } from "../drag-ghost.js";
import { REORDER_ICONS } from "../editor-icons.js";
import { editorMediaHtml, editorMediaSrc } from "../forms/media-url.js";

export type BindingChoice = { id: string; title?: string };
export type FolderChoice = { id: string };

type Choices = { bindings: BindingChoice[]; folders: FolderChoice[]; panelTones: PanelToneDef[] };

type EditColumns = {
  uid: string;
  kind: "columns";
  layout: ColumnLayoutId;
  cells: { className: string; items: EditNode[] }[];
};

type EditCard = {
  uid: string;
  kind: "card";
  title: string;
  width: BlockWidthId;
  plain: boolean;
  items: EditNode[];
};

type EditPanel = {
  uid: string;
  kind: "panel";
  tone: ToneId;
  items: EditNode[];
};

type EditLeaf = { uid: string } & Exclude<Section, { kind: "columns" } | { kind: "card" } | { kind: "panel" }>;
type EditNode = EditLeaf | EditColumns | EditCard | EditPanel;

type ZoneState = {
  name: string;
  host: HTMLElement;
  items: EditNode[];
};

type ComposeDrag =
  | { kind: "palette"; palette: string }
  | { kind: "item"; zone: string; uid: string };

type Mounted = {
  zones: ZoneState[];
  bindings: BindingChoice[];
  folders: FolderChoice[];
  panelTones: PanelToneDef[];
  active: string;
  locked: boolean;
  drag?: ComposeDrag;
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
    panelTones?: PanelToneDef[];
    htmlByZone: Record<string, string>;
    locked?: boolean;
    onEdit?: (burstId?: string) => void;
  },
): void {
  const panelTones = options.panelTones ?? [];
  const zones: ZoneState[] = [];
  for (const host of form.querySelectorAll<HTMLElement>("[data-canvas]")) {
    const name = host.dataset.zone ?? "";
    zones.push({
      name,
      host,
      items: parseSections(options.htmlByZone[name] ?? "", panelTones).map(toEdit),
    });
  }
  const state: Mounted = {
    zones,
    bindings: options.bindings,
    folders: options.folders ?? [],
    panelTones,
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
    state.drag = undefined;
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
  for (const zone of state.zones) {
    html[zone.name] = paintSections(zone.items.map(toSection), state.panelTones);
  }
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
      layout: section.layout,
      cells: section.cells.map((cell) => ({
        className: cell.className,
        items: cell.sections.map(toEdit),
      })),
    };
  }
  if (section.kind === "card") {
    return {
      uid: nextId(),
      kind: "card",
      title: section.title,
      width: section.width,
      plain: section.plain,
      items: section.sections.map(toEdit),
    };
  }
  if (section.kind === "panel") {
    return {
      uid: nextId(),
      kind: "panel",
      tone: section.tone,
      items: section.sections.map(toEdit),
    };
  }
  return { uid: nextId(), ...section };
}

function toSection(node: EditNode): Section {
  if (node.kind === "columns") {
    return {
      kind: "columns",
      layout: node.layout,
      cells: node.cells.map((cell) => ({
        className: cell.className,
        sections: cell.items.map(toSection),
      })),
    };
  }
  if (node.kind === "card") {
    return {
      kind: "card",
      title: node.title,
      width: node.width,
      plain: node.plain,
      sections: node.items.map(toSection),
    };
  }
  if (node.kind === "panel") {
    return { kind: "panel", tone: node.tone, sections: node.items.map(toSection) };
  }
  const { uid: _uid, ...section } = node;
  if (section.kind === "text") {
    const { loose, ...rest } = section;
    return loose ? { ...rest, loose: true } : rest;
  }
  return section;
}

function renderZone(form: HTMLElement, zone: ZoneState): void {
  const state = mounted.get(form);
  if (!state) return;
  const empty = "";
  const body = zone.items.length
    ? state.locked
      ? zone.items.map((item) => renderItem(item, choicesFor(zone.host), zone.name, true, 0, 1)).join("")
      : itemsWithDrops(zone)
    : state.locked
      ? ""
      : dropSlot(zone.name, 0);
  zone.host.innerHTML = `${empty}${body}`;
}

function itemsWithDrops(zone: ZoneState): string {
  const parts: string[] = [dropSlot(zone.name, 0)];
  zone.items.forEach((item, index) => {
    parts.push(renderItem(item, choicesFor(zone.host), zone.name, false, index, zone.items.length));
    parts.push(dropSlot(zone.name, index + 1));
  });
  return parts.join("");
}

function sectionActions(index: number, count: number): string {
  const up = index <= 0 ? " disabled" : "";
  const down = index >= count - 1 ? " disabled" : "";
  return `<span class="editor-section-actions">${sectionIcon("Up", REORDER_ICONS.up, `data-move="up"${up}`)}${sectionIcon("Down", REORDER_ICONS.down, `data-move="down"${down}`)}${sectionIcon("Remove", REORDER_ICONS.remove, "data-remove")}</span>`;
}

function sectionIcon(label: string, icon: string, attributes: string): string {
  return `<button type="button" class="editor-section-icon" aria-label="${label}" title="${label}" ${attributes}>${icon}</button>`;
}

function choicesFor(host: HTMLElement): Choices {
  const form = host.closest("form");
  const state = form ? mounted.get(form) : undefined;
  return {
    bindings: state?.bindings ?? [],
    folders: state?.folders ?? [],
    panelTones: state?.panelTones ?? [],
  };
}

function renderItem(node: EditNode, choices: Choices, zone: string, locked: boolean, index = 0, count = 1): string {
  const drag = locked ? "" : `<span class="editor-handle" draggable="true" data-drag title="Drag to move">Drag</span>`;
  const actions = locked ? "" : sectionActions(index, count);
  return `<article class="editor-section" data-item-id="${node.uid}" data-zone="${escapeAttr(zone)}">
    <div class="editor-section-bar">
      ${drag}
      <span class="editor-section-kind">${escapeText(labelFor(node))}</span>
      ${propsFor(node, choices, locked)}
      ${actions}
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
      return `${levelSelect(node.level)}${superSpaceCheck(node)}${editingToolbar(inlineTools(), listTools())}`;
    case "panel":
      return `<label class="editor-prop">Tone <select data-field="tone">${toneOptions(node.tone, choices.panelTones)}</select></label>`;
    case "quote":
      return `<label class="editor-prop">Tone <select data-field="tone">${toneOptions(node.tone, choices.panelTones)}</select></label><label class="editor-prop">Attribution <input data-field="attribution" class="w3-input" value="${escapeAttr(node.attribution)}"></label>`;
    case "imgbox":
      return `${imgboxFields(node)}${widthSelect(node.width)}<label class="editor-prop">Hide frame <input type="checkbox" data-field="plain"${node.plain ? " checked" : ""}></label>`;
    case "card":
      return `<label class="editor-prop">Title <input data-field="title" class="w3-input" value="${escapeAttr(node.title)}"></label>${widthSelect(node.width)}<label class="editor-prop">Hide frame <input type="checkbox" data-field="plain"${node.plain ? " checked" : ""}></label>`;
    case "columns":
      return layoutSelect(node.layout);
    case "insert":
      return choices.bindings.length
        ? `<label class="editor-prop">Binding <select data-field="id">${bindingOptions(choices.bindings, node.id)}</select></label>`
        : `<label class="editor-prop">Binding id <input data-field="id" class="w3-input" value="${escapeAttr(node.id)}" placeholder="Binding id"></label>`;
    case "subpages":
      return `<label class="editor-prop">Heading <input data-field="title" class="w3-input" value="${escapeAttr(node.title)}" placeholder="Optional"></label>`;
    case "youtube":
      return youtubeProps(node);
    case "gallery":
      return `<label class="editor-prop">Folder <select data-field="folder">${folderOptions(choices.folders, node.folder)}</select></label><label class="editor-prop">Layout <select data-field="mode"><option value="grid"${node.mode === "grid" ? " selected" : ""}>Grid</option><option value="slides"${node.mode === "slides" ? " selected" : ""}>Slides</option></select></label>`;
    case "pasted":
      return editingToolbar(inlineTools());
    case "html":
      return "";
  }
}

function lockedProps(node: EditNode, choices: Choices): string {
  switch (node.kind) {
    case "text":
      return `${superSpaceCheck(node)}${editingToolbar(inlineTools(), listTools())}`;
    case "pasted":
      return editingToolbar(inlineTools());
    case "quote":
      return `<label class="editor-prop">Attribution <input data-field="attribution" class="w3-input" value="${escapeAttr(node.attribution)}"></label>`;
    case "imgbox":
      return imgboxFields(node);
    case "card":
      return `<label class="editor-prop">Title <input data-field="title" class="w3-input" value="${escapeAttr(node.title)}"></label>`;
    case "gallery":
      return `<label class="editor-prop">Folder <select data-field="folder">${folderOptions(choices.folders, node.folder)}</select></label>`;
    case "youtube":
      return youtubeProps(node);
    case "subpages":
      return `<label class="editor-prop">Heading <input data-field="title" class="w3-input" value="${escapeAttr(node.title)}" placeholder="Optional"></label>`;
    default:
      return "";
  }
}

function imgboxFields(node: Extract<EditLeaf, { kind: "imgbox" }>): string {
  return `<label class="editor-prop">Image <input data-field="src" class="w3-input" value="${escapeAttr(node.src)}" placeholder="Image address"></label><button type="button" class="w3-button w3-small w3-white" data-library="image">Library</button><label class="editor-prop">Alt <input data-field="alt" class="w3-input" value="${escapeAttr(node.alt)}"></label><label class="editor-prop">Caption <input data-field="caption" class="w3-input" value="${escapeAttr(node.caption)}"></label>`;
}

function widthSelect(width: BlockWidthId): string {
  const options = BLOCK_WIDTHS.map(
    (item) => `<option value="${item.id}"${item.id === width ? " selected" : ""}>${escapeText(item.label)}</option>`,
  ).join("");
  return `<label class="editor-prop">Width <select data-field="width">${options}</select></label>`;
}

function youtubeProps(node: Extract<EditLeaf, { kind: "youtube" }>): string {
  return `<label class="editor-prop">Video <input data-field="video" class="w3-input" value="${escapeAttr(node.videoId)}" placeholder="YouTube address or id"></label><label class="editor-prop">Video title <input data-field="title" class="w3-input" value="${escapeAttr(node.title)}" placeholder="For screen readers"></label>`;
}

function layoutSelect(layout: ColumnLayoutId): string {
  const options = COLUMN_LAYOUTS.map(
    (item) => `<option value="${item.id}"${item.id === layout ? " selected" : ""}>${escapeText(item.label)}</option>`,
  ).join("");
  return `<label class="editor-prop">Layout <select data-field="layout">${options}</select></label>`;
}

function retagHeading(article: HTMLElement, level: HeadingLevel, field: "heading" | "text"): void {
  const current = article.querySelector<HTMLElement>(`[data-field="${field}"]`);
  if (!current || current.tagName === `H${level}`) return;
  const next = document.createElement(`h${level}`);
  for (const attr of current.attributes) next.setAttribute(attr.name, attr.value);
  next.innerHTML = current.innerHTML;
  current.replaceWith(next);
}

function levelSelect(level: HeadingLevel): string {
  return `<label class="editor-prop">Level <select data-field="level">${[1, 2, 3, 4]
    .map((item) => `<option value="${item}"${level === item ? " selected" : ""}>${item}</option>`)
    .join("")}</select></label>`;
}

function superSpaceCheck(node: Extract<EditLeaf, { kind: "text" }>): string {
  return `<label class="editor-prop">Super space <input type="checkbox" data-field="loose"${node.loose ? " checked" : ""}></label>`;
}

function editingToolbar(inline: string, list = ""): string {
  return `<span class="editor-section-editing-tools"><span class="editor-prop">${inline}${list}</span></span>`;
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
      return `<h${node.level} class="${BLOCK_CLASS}" contenteditable="true" data-field="text" data-plain="true" data-placeholder="Heading">${escapeText(node.text)}</h${node.level}>`;
    case "text":
      return `<div class="${joinClass(BLOCK_CLASS, "editor-text", node.loose ? "tessera-loose" : "")}"><h${node.level} contenteditable="true" data-field="heading" data-plain="true" data-placeholder="Heading">${escapeText(node.heading)}</h${node.level}><div class="editor-text-body" contenteditable="true" data-field="html" data-blocks="true" data-placeholder="Write…">${htmlForEditing(node.html)}</div></div>`;
    case "panel":
      return panelBody(node, choices, zone, locked);
    case "quote":
      return quoteBody(node, choices.panelTones);
    case "imgbox":
      return imgboxBody(node);
    case "card":
      return cardBody(node, choices, zone, locked);
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
      return `<div class="${joinClass(BLOCK_CLASS, "tessera-pasted")}"><div class="tessera-pasted-sheet"><div contenteditable="true" data-field="html" data-placeholder="Write on the paper…">${htmlForEditing(node.html)}</div></div></div>`;
    case "html":
      return `<div class="editor-html-preview">${editorMediaHtml(renderMarkdownLinks(node.html))}</div>`;
  }
}

function youtubeBody(node: Extract<EditLeaf, { kind: "youtube" }>): string {
  const id = youtubeVideoId(node.videoId);
  if (!id) return `<p class="w3-text-grey">Add a YouTube address.</p>`;
  return `<div class="${joinClass(BLOCK_CLASS, "tessera-youtube")}"><div class="tessera-video"><iframe src="https://www.youtube-nocookie.com/embed/${escapeAttr(id)}" title="${escapeAttr(node.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></div>`;
}

function blockWidthAttr(width: BlockWidthId): string {
  return width === "full" ? "" : ` data-width="${width}"`;
}

function quoteBody(node: Extract<EditLeaf, { kind: "quote" }>, panelTones: PanelToneDef[]): string {
  return quoteBlockHtml(
    node.text,
    node.attribution,
    node.tone,
    {
      textAttributes: 'contenteditable="true" data-field="text" data-plain="true" data-placeholder="Quote"',
      attributionAttributes: "data-quote-by",
    },
    panelTones,
  );
}

function imgboxBody(node: Extract<EditLeaf, { kind: "imgbox" }>): string {
  const caption = node.caption
    ? `<div class="w3-display-middle w3-container w3-padding-16 w3-round-large w3-white" data-caption>${escapeText(node.caption)}</div>`
    : `<div class="w3-display-middle w3-hide" data-caption></div>`;
  const src = node.src ? editorMediaSrc(node.src) : "";
  return `<div class="${imgboxClass(node.plain)}"${blockWidthAttr(node.width)}>${src ? `<img src="${escapeAttr(src)}" class="w3-image" alt="${escapeAttr(node.alt)}">` : `<p class="w3-text-grey">Add an image address.</p>`}${caption}</div>`;
}

function panelBody(node: EditPanel, choices: Choices, zone: string, locked: boolean): string {
  const inner = nestedItems(node.items, choices, zone, locked, node.uid, "");
  return `<div class="${joinClass(BLOCK_CLASS, "w3-panel", "w3-padding", toneClass(node.tone, choices.panelTones))}"><div class="rt-panel-body editor-cell">${inner}</div></div>`;
}

function cardBody(node: EditCard, choices: Choices, zone: string, locked: boolean): string {
  const inner = nestedItems(node.items, choices, zone, locked, node.uid, "");
  return `<div class="${cardClass(node.plain)}"${blockWidthAttr(node.width)}><h3 class="w3-text-theme" data-card-title>${escapeText(node.title)}</h3><div class="rt-card-body editor-cell">${inner}</div></div>`;
}

function columnsBody(node: EditColumns, choices: Choices, zone: string, locked: boolean): string {
  const widths = columnWidths(node.layout);
  const cells = node.cells
    .map((cell, index) => {
      const inner = nestedItems(cell.items, choices, zone, locked, node.uid, index);
      return `<div class="${joinClass(widths[index] ?? "", cell.className)} editor-cell">${inner}</div>`;
    })
    .join("");
  return `<div class="${joinClass(BLOCK_CLASS, "w3-row-padding", "w3-stretch")}">${cells}</div>`;
}

function nestedItems(items: EditNode[], choices: Choices, zone: string, locked: boolean, parent: string, cell: string | number): string {
  if (locked) return items.map((item) => renderItem(item, choices, zone, true)).join("");
  if (!items.length) return dropSlot(zone, 0, parent, cell);
  return items
    .map(
      (item, index) =>
        `${index === 0 ? dropSlot(zone, 0, parent, cell) : ""}${renderItem(item, choices, zone, false, index, items.length)}${dropSlot(zone, index + 1, parent, cell)}`,
    )
    .join("");
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
  if (!node) return;
  if (state.locked && isDesignField(node.kind, field)) return;
  mark(form);
  try {
    if (node.kind === "columns") {
      if (field === "layout" && fromChange && target instanceof HTMLSelectElement && isColumnLayout(target.value)) {
        setColumnLayout(form, node, target.value);
      }
      return;
    }
    if (field === "html" && target.isContentEditable && node.kind === "text") {
      node.html = htmlFromEditing(target.innerHTML, true);
      return;
    }
    if (field === "html" && target.isContentEditable && node.kind === "pasted") {
      node.html = htmlFromEditing(target.innerHTML, false);
      return;
    }
    if (field === "heading" && target.isContentEditable && node.kind === "text") {
      node.heading = (target.textContent ?? "").replace(/\n+/g, " ");
      return;
    }
    if (node.kind === "text" && field === "loose" && target instanceof HTMLInputElement) {
      node.loose = target.checked;
      article?.querySelector(".editor-text")?.classList.toggle("tessera-loose", node.loose);
      return;
    }
    if (field === "text" && target.isContentEditable) {
      if (node.kind === "heading" || node.kind === "quote") node.text = target.textContent ?? "";
      return;
    }
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    const value = target.value;
    if ((node.kind === "heading" || node.kind === "text") && field === "level") {
      node.level = parseHeadingLevel(value);
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
      if (field === "plain" && target instanceof HTMLInputElement) node.plain = target.checked;
      if (field === "width") node.width = isBlockWidth(value) ? value : "twothird";
      if (fromChange) rerenderArticle(form, node.uid);
      return;
    }
    if (node.kind === "card") {
      if (field === "title") {
        node.title = value;
        const title = article?.querySelector("[data-card-title]");
        if (title) title.textContent = value;
        return;
      }
      if (field === "width") {
        node.width = isBlockWidth(value) ? value : "full";
        if (fromChange) rerenderArticle(form, node.uid);
        return;
      }
      if (field === "plain" && target instanceof HTMLInputElement) {
        node.plain = target.checked;
        if (fromChange) rerenderArticle(form, node.uid);
        return;
      }
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
    if (node.kind === "youtube") {
      if (field === "video") {
        const id = youtubeVideoId(value);
        node.videoId = id || value.trim();
        if (fromChange && id) rerenderArticle(form, node.uid);
        return;
      }
      if (field === "title") {
        node.title = value;
        if (fromChange) rerenderArticle(form, node.uid);
        return;
      }
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
  if (field === "level" || field === "tone" || field === "mode" || field === "layout" || field === "plain" || field === "width")
    return true;
  return kind === "insert" && field === "id";
}

function onClick(form: HTMLFormElement, event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
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
  const listToggle = target.closest<HTMLElement>("[data-compose-list]");
  if (listToggle && form.contains(listToggle)) {
    event.preventDefault();
    const on = form.classList.toggle("editor-compose-list");
    listToggle.setAttribute("aria-pressed", on ? "true" : "false");
    listToggle.textContent = on ? "Editors" : "List";
    return;
  }
  const move = target.closest<HTMLButtonElement>("[data-move]");
  if (move?.dataset.move === "up" || move?.dataset.move === "down") {
    event.preventDefault();
    if (state.locked || move.disabled) return;
    moveSection(form, state, move);
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

function moveSection(form: HTMLFormElement, state: Mounted, button: HTMLButtonElement): void {
  const article = button.closest<HTMLElement>("[data-item-id]");
  const uid = article?.dataset.itemId;
  if (!uid) return;
  const found = locate(state, uid);
  if (!found) return;
  const next = button.dataset.move === "up" ? found.index - 1 : found.index + 1;
  if (next < 0 || next >= found.list.length) return;
  mark(form);
  const [item] = found.list.splice(found.index, 1);
  if (!item) return;
  found.list.splice(next, 0, item);
  const zone = zoneOf(state, uid);
  if (zone) renderZone(form, zone);
  notifyStructure(form);
}

function appendPalette(form: HTMLFormElement, kind: string): void {
  const state = mounted.get(form);
  if (!state || state.locked || !isPaletteKind(kind)) return;
  const zone = state.zones.find((item) => item.name === state.active) ?? state.zones[0];
  if (!zone) return;
  if (kind === "columns" && focusedColumns(state)) return;
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
    const saved = cloneSelection();
    const href = window.prompt("Link address");
    if (!href || /^\s*javascript:/i.test(href)) return;
    restoreSelection(saved);
    insertMarkdownLink(href);
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
    clearInlineFormatting();
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

function cloneSelection(): Range | null {
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  return sel.getRangeAt(0).cloneRange();
}

function restoreSelection(range: Range | null): void {
  if (!range) return;
  const sel = document.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

function selectionAnchor(): HTMLAnchorElement | null {
  const sel = document.getSelection();
  const node = sel?.anchorNode;
  const from = node instanceof Element ? node : node?.parentElement;
  const editable = from?.closest("[contenteditable]");
  const link = from?.closest("a");
  return link instanceof HTMLAnchorElement && editable?.contains(link) ? link : null;
}

function clearInlineFormatting(): void {
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const from = node instanceof Element ? node : node.parentElement;
  const editable = from?.closest<HTMLElement>("[contenteditable]");
  if (!editable) return;
  const tags = ["b", "strong", "i", "em", "u", "s", "strike", "code", "span"];
  for (const tag of tags) {
    const hits = [...editable.querySelectorAll(tag)];
    for (const el of hits) {
      if (tag === "span" && !el.getAttribute("style")) continue;
      if (!range.intersectsNode(el) && !el.contains(range.startContainer)) continue;
      el.replaceWith(...el.childNodes);
    }
  }
}

function touchEditable(): void {
  const sel = document.getSelection();
  const node = sel?.anchorNode;
  const el = node instanceof Element ? node : node?.parentElement;
  el?.closest("[contenteditable]")?.dispatchEvent(new Event("input", { bubbles: true }));
}

function setColumnLayout(form: HTMLFormElement, node: EditColumns, layout: ColumnLayoutId): void {
  const state = mounted.get(form);
  if (!state || state.locked) return;
  const count = columnWidths(layout).length;
  syncAll(state);
  node.layout = layout;
  while (node.cells.length < count) node.cells.push({ className: "", items: [] });
  while (node.cells.length > count) {
    const removed = node.cells.pop();
    const kept = node.cells[node.cells.length - 1];
    if (removed && kept) kept.items.push(...removed.items);
  }
  const zone = zoneOf(state, node.uid);
  if (zone) renderZone(form, zone);
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
    if (pasted) document.execCommand("insertHTML", false, htmlForEditing(pasted));
    return;
  }
  document.execCommand(
    "insertHTML",
    false,
    html ? htmlForEditing(sanitize(html)) : escapeText(text).replace(/\n/g, "<br>"),
  );
}

function onDragStart(form: HTMLFormElement, event: DragEvent): void {
  const state = mounted.get(form);
  if (state?.locked) {
    event.preventDefault();
    return;
  }
  const target = event.target;
  if (!(target instanceof HTMLElement) || !event.dataTransfer || !state) return;
  suppressClick = true;
  state.drag = undefined;
  const palette = target.closest<HTMLElement>("[data-palette]");
  if (palette?.dataset.palette) {
    state.drag = { kind: "palette", palette: palette.dataset.palette };
    event.dataTransfer.setData("application/x-tessera-palette", palette.dataset.palette);
    event.dataTransfer.setData("text/plain", palette.dataset.palette);
    event.dataTransfer.effectAllowed = "copy";
    setDragGhost(event.dataTransfer, palette.textContent ?? "");
    beginDropPreview(form);
    return;
  }
  const handle = target.closest<HTMLElement>("[data-drag]");
  const article = handle?.closest<HTMLElement>("[data-item-id]");
  const zone = article?.dataset.zone;
  const uid = article?.dataset.itemId;
  if (!handle || !uid || !zone) return;
  state.drag = { kind: "item", zone, uid };
  event.dataTransfer.setData("application/x-tessera-item", `${zone}\t${uid}`);
  event.dataTransfer.setData("text/plain", uid);
  event.dataTransfer.effectAllowed = "move";
  setDragGhost(event.dataTransfer, article.querySelector(".editor-section-kind")?.textContent ?? "");
  beginDropPreview(form);
  event.stopPropagation();
}

function onDragOver(form: HTMLFormElement, event: DragEvent): void {
  const state = mounted.get(form);
  if (state?.locked) return;
  const slot = resolveSlot(event.target, form);
  if (!slot) return;
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = state?.drag?.kind === "item" ? "move" : "copy";
  }
  clearDropActive(form);
  slot.classList.add("editor-drop-active");
}

function onDrop(form: HTMLFormElement, event: DragEvent): void {
  const state = mounted.get(form);
  if (state?.locked) return;
  const slot = resolveSlot(event.target, form);
  if (!slot || !state || !event.dataTransfer) return;
  event.preventDefault();
  clearDrop(form);
  const drag = state.drag;
  state.drag = undefined;
  syncAll(state);
  const zoneName = slot.dataset.dropZone ?? "";
  const index = Number(slot.dataset.dropIndex ?? "0");
  const parent = slot.dataset.dropParent || "";
  const cell = Number(slot.dataset.dropCell || "0");
  const list = listFor(state, zoneName, parent, cell);
  if (!list) return;
  const host = parent ? findNode(zoneItems(state, zoneName), parent) : undefined;
  const palette = paletteFromDrop(drag, event.dataTransfer);
  if (palette) {
    if (!isPaletteKind(palette)) return;
    if (palette === "columns" && host?.kind === "columns") return;
    list.splice(index, 0, toEdit(blankSection(palette)));
    mark(form);
    renderAll(form, state);
    notifyStructure(form);
    return;
  }
  const uid = itemUidFromDrop(drag, event.dataTransfer);
  if (!uid || parent === uid) return;
  const moving = findNode(allItems(state), uid);
  if (parent && host?.kind === "columns" && isColumns(moving)) return;
  if (parent && containsNode(moving, parent)) return;
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

function paletteFromDrop(drag: ComposeDrag | undefined, transfer: DataTransfer): string {
  if (drag?.kind === "palette") return drag.palette;
  if (drag?.kind === "item") return transfer.getData("application/x-tessera-palette");
  return transfer.getData("application/x-tessera-palette") || transfer.getData("text/plain");
}

function itemUidFromDrop(drag: ComposeDrag | undefined, transfer: DataTransfer): string {
  if (drag?.kind === "item") return drag.uid;
  const itemData = transfer.getData("application/x-tessera-item");
  if (itemData) return itemData.split("\t")[1] ?? "";
  return transfer.getData("text/plain");
}

function listFor(state: Mounted, zoneName: string, parent: string, cell: number): EditNode[] | undefined {
  const zone = state.zones.find((item) => item.name === zoneName);
  if (!zone) return;
  if (!parent) return zone.items;
  const host = findNode(zone.items, parent);
  if (host?.kind === "card" || host?.kind === "panel") return host.items;
  if (host?.kind === "columns") return host.cells[cell]?.items;
  return;
}

function zoneItems(state: Mounted, zoneName: string): EditNode[] {
  return state.zones.find((item) => item.name === zoneName)?.items ?? [];
}

function locate(state: Mounted, uid: string): { list: EditNode[]; index: number } | undefined {
  const search = (list: EditNode[]): { list: EditNode[]; index: number } | undefined => {
    const index = list.findIndex((item) => item.uid === uid);
    if (index >= 0) return { list, index };
    for (const item of list) {
      for (const nested of childLists(item)) {
        const found = search(nested);
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
  return list.some((item) => childLists(item).some((nested) => removeNode(nested, uid)));
}

function findNode(list: EditNode[], uid: string): EditNode | undefined {
  for (const item of list) {
    if (item.uid === uid) return item;
    for (const nested of childLists(item)) {
      const found = findNode(nested, uid);
      if (found) return found;
    }
  }
  return;
}

function childLists(node: EditNode): EditNode[][] {
  if (node.kind === "columns") return node.cells.map((cell) => cell.items);
  if (node.kind === "card" || node.kind === "panel") return [node.items];
  return [];
}

function containsNode(node: EditNode | undefined, uid: string): boolean {
  if (!node) return false;
  return childLists(node).some((list) => list.some((item) => item.uid === uid || containsNode(item, uid)));
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
        node.html = htmlFromEditing(field.innerHTML, true);
      }
      if (field.dataset.field === "heading" && field.isContentEditable && node.kind === "text") {
        node.heading = (field.textContent ?? "").replace(/\n+/g, " ");
      }
      if (field.dataset.field === "html" && field.isContentEditable && node.kind === "pasted") {
        node.html = htmlFromEditing(field.innerHTML, false);
      }
      if (field.dataset.field === "text" && field.isContentEditable && (node.kind === "heading" || node.kind === "quote")) {
        node.text = field.textContent ?? "";
      }
      if (field instanceof HTMLInputElement && field.type === "checkbox") {
        applyControl(node, field.dataset.field ?? "", field.checked ? "true" : "false");
      } else if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
        applyControl(node, field.dataset.field ?? "", field.value);
      }
    }
  }
}

function applyControl(node: EditLeaf | EditCard | EditPanel, field: string, value: string): void {
  if ((node.kind === "heading" || node.kind === "text") && field === "level") node.level = parseHeadingLevel(value);
  if ((node.kind === "panel" || node.kind === "quote") && field === "tone" && isTone(value)) node.tone = value;
  if (node.kind === "quote" && field === "attribution") node.attribution = value;
  if (node.kind === "imgbox" && field === "src") node.src = value;
  if (node.kind === "imgbox" && field === "alt") node.alt = value;
  if (node.kind === "imgbox" && field === "caption") node.caption = value;
  if (node.kind === "imgbox" && field === "plain") node.plain = value === "true";
  if (node.kind === "imgbox" && field === "width" && isBlockWidth(value)) node.width = value;
  if (node.kind === "text" && field === "loose") node.loose = value === "true";
  if (node.kind === "card" && field === "title") node.title = value;
  if (node.kind === "card" && field === "plain") node.plain = value === "true";
  if (node.kind === "card" && field === "width" && isBlockWidth(value)) node.width = value;
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

function beginDropPreview(form: HTMLFormElement): void {
  form.classList.add("editor-dragging");
}

function clearDropActive(form: HTMLElement): void {
  for (const line of form.querySelectorAll(".editor-drop-active")) line.classList.remove("editor-drop-active");
}

function clearDrop(form: HTMLElement): void {
  clearDropActive(form);
  form.classList.remove("editor-dragging");
}

function focusedColumns(state: Mounted): boolean {
  const slot = document.activeElement?.closest<HTMLElement>("[data-drop-parent]");
  const parent = slot?.getAttribute("data-drop-parent") ?? "";
  if (!parent) return false;
  return findNode(allItems(state), parent)?.kind === "columns";
}

function toneOptions(current: ToneId, panelTones: PanelToneDef[]): string {
  const ids = paletteToneIds(panelTones, current);
  return ids
    .map(
      (id) =>
        `<option value="${id}"${id === current ? " selected" : ""}>${escapeText(toneLabel(id, panelTones))}</option>`,
    )
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
  return /^[a-z][a-z0-9-]*$/.test(value);
}

const ALLOWED = new Set(["strong", "b", "em", "i", "u", "s", "code", "a", "br", "ul", "ol", "li", "p"]);

const MARKDOWN_LINK_SELECTION = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/;

function htmlForEditing(stored: string): string {
  return restoreMarkdownLinks(stored);
}

function htmlFromEditing(innerHTML: string, blocks: boolean): string {
  const raw = blocks ? readTextHtml(innerHTML) : sanitize(innerHTML);
  return renderMarkdownLinks(raw);
}

function insertMarkdownLink(href: string): void {
  const trimmed = href.trim();
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const selected = sel.toString();
  const mdMatch = selected.match(MARKDOWN_LINK_SELECTION);
  if (mdMatch) {
    const label = mdMatch[1] ?? "";
    document.execCommand("insertText", false, `[${label}](${trimmed})`);
    touchEditable();
    return;
  }
  const existing = selectionAnchor();
  if (existing) {
    const label = (existing.textContent ?? "").trim() || trimmed;
    existing.replaceWith(document.createTextNode(`[${label}](${trimmed})`));
    touchEditable();
    return;
  }
  const label = selected || trimmed;
  document.execCommand("insertText", false, `[${label}](${trimmed})`);
  touchEditable();
}

function paragraphsFromPlain(text: string): string {
  const parts: string[] = [];
  let current = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "\n") {
      let run = 0;
      while (i < text.length && text[i] === "\n") {
        run++;
        i++;
      }
      if (run >= 2) {
        parts.push(current);
        current = "";
        for (let blank = 0; blank < run - 2; blank++) parts.push("");
      } else {
        current += "\n";
      }
      continue;
    }
    current += text[i]!;
    i++;
  }
  parts.push(current);
  const html = parts
    .map((part) => {
      if (!part.trim()) return "<p><br></p>";
      return `<p>${escapeText(part).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
  return textBlocksHaveWords(html) ? html : "";
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
      if (!inner.replace(/<br>/gi, "").trim()) {
        const open = tag === "p" ? tagOpen(node, "p") : "p";
        out += `<${open}><br></p>`;
        continue;
      }
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
  return textBlocksHaveWords(out) ? out : "";
}

function textBlocksHaveWords(html: string): boolean {
  return html.replace(/<[^>]+>/g, "").replace(/\s/g, "") !== "";
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
