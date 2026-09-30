import {
  PALETTE_TONES,
  blankSection,
  paintSections,
  parseSections,
  toneClass,
  toneLabel,
  type PaletteKind,
  type Section,
  type ToneId,
} from "@r-a-i-t-h/tessera-sections";

export type BindingChoice = { id: string; title?: string };

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
  active: string;
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
  options: { bindings: BindingChoice[]; htmlByZone: Record<string, string> },
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
    active: zones.find((zone) => zone.name === "main")?.name ?? zones[0]?.name ?? "",
  };
  mounted.set(form, state);
  for (const zone of zones) renderZone(form, zone);

  form.addEventListener("pointerdown", (event) => {
    const canvas = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-canvas]");
    if (canvas?.dataset.zone) state.active = canvas.dataset.zone;
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
  if (!mounted.get(form)) return;
  const empty = zone.items.length ? "" : `<p class="editor-canvas-empty w3-text-grey">Drag a section here, or choose one from the list.</p>`;
  zone.host.innerHTML = `${empty}${zone.items.length ? itemsWithDrops(zone) : dropSlot(zone.name, 0)}`;
}

function itemsWithDrops(zone: ZoneState): string {
  const parts: string[] = [dropSlot(zone.name, 0)];
  zone.items.forEach((item, index) => {
    parts.push(renderItem(item, mountedBindings(zone.host), zone.name));
    parts.push(dropSlot(zone.name, index + 1));
  });
  return parts.join("");
}

function mountedBindings(host: HTMLElement): BindingChoice[] {
  const form = host.closest("form");
  if (!form) return [];
  return mounted.get(form)?.bindings ?? [];
}

function renderItem(node: EditNode, bindings: BindingChoice[], zone: string): string {
  return `<article class="editor-section" data-item-id="${node.uid}" data-zone="${escapeAttr(zone)}">
    <div class="editor-section-bar">
      <span class="editor-handle" draggable="true" data-drag title="Drag to move">Drag</span>
      <span class="editor-section-kind">${escapeText(labelFor(node))}</span>
      ${propsFor(node, bindings)}
      <button type="button" class="w3-button w3-small w3-white" data-remove>Remove</button>
    </div>
    <div class="editor-section-body">${bodyFor(node, bindings, zone)}</div>
  </article>`;
}

function labelFor(node: EditNode): string {
  switch (node.kind) {
    case "heading":
      return "Heading";
    case "text":
      return node.tag === "p" ? "Text" : "List";
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
    case "html":
      return "Custom HTML";
  }
}

function propsFor(node: EditNode, bindings: BindingChoice[]): string {
  switch (node.kind) {
    case "heading":
      return `<label class="editor-prop">Level <select data-field="level">${[1, 2, 3]
        .map((level) => `<option value="${level}"${node.level === level ? " selected" : ""}>${level}</option>`)
        .join("")}</select></label>`;
    case "text":
      return `<span class="editor-prop">${inlineTools()}<button type="button" class="w3-button w3-small w3-white" data-list>${node.tag === "p" ? "Make list" : "Make paragraph"}</button></span>`;
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
      return bindings.length
        ? `<label class="editor-prop">Binding <select data-field="id">${bindingOptions(bindings, node.id)}</select></label>`
        : `<label class="editor-prop">Binding id <input data-field="id" class="w3-input" value="${escapeAttr(node.id)}" placeholder="Binding id"></label>`;
    case "html":
      return `<span class="editor-prop w3-text-grey">Edit this markup on Fields.</span>`;
  }
}

function inlineTools(): string {
  return `<span class="editor-inline"><button type="button" class="w3-button w3-small w3-white" data-cmd="bold">Bold</button><button type="button" class="w3-button w3-small w3-white" data-cmd="italic">Italic</button><button type="button" class="w3-button w3-small w3-white" data-cmd="link">Link</button></span>`;
}

function bodyFor(node: EditNode, bindings: BindingChoice[], zone: string): string {
  switch (node.kind) {
    case "heading":
      return `<h${node.level} contenteditable="true" data-field="text" data-plain="true" data-placeholder="Heading">${escapeText(node.text)}</h${node.level}>`;
    case "text":
      return `<${node.tag} contenteditable="true" data-field="html" data-placeholder="Write…">${node.html}</${node.tag}>`;
    case "panel":
      return `<div class="${joinClass("w3-panel", "w3-padding", toneClass(node.tone))}"><div contenteditable="true" data-field="html" data-placeholder="Panel">${node.html}</div></div>`;
    case "quote":
      return quoteBody(node);
    case "imgbox":
      return imgboxBody(node);
    case "card":
      return `<div class="w3-card w3-padding w3-margin-bottom w3-white"><h3 class="w3-text-theme" data-card-title>${escapeText(node.title)}</h3><div class="rt-card-body" contenteditable="true" data-field="html" data-placeholder="Card">${node.html}</div></div>`;
    case "columns":
      return columnsBody(node, bindings, zone);
    case "insert": {
      const title = bindings.find((binding) => binding.id === node.id)?.title;
      const name = node.id ? (title && title !== node.id ? `${title} (${node.id})` : node.id) : "Choose a binding";
      return `<p class="w3-panel w3-pale-yellow">Insert: ${escapeText(name)}</p>`;
    }
    case "html":
      return `<div class="editor-html-preview">${node.html}</div>`;
  }
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
  return `<div class="w3-display-container w3-container w3-padding-16 w3-card w3-center">${src ? `<img src="${escapeAttr(src)}" class="w3-image" style="width: 100%" alt="${escapeAttr(node.alt)}">` : `<p class="w3-text-grey">Add an image address.</p>`}${caption}</div>`;
}

function columnsBody(node: EditColumns, bindings: BindingChoice[], zone: string): string {
  const layout = node.cells.length === 3 ? "w3-third" : "w3-half";
  const cells = node.cells
    .map((cell, index) => {
      const inner = cell.items.length
        ? cell.items.map((item, itemIndex) => `${itemIndex === 0 ? dropSlot(zone, 0, node.uid, index) : ""}${renderItem(item, bindings, zone)}${dropSlot(zone, itemIndex + 1, node.uid, index)}`).join("")
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
  mark(form);
  if (field === "html" && target.isContentEditable && (node.kind === "text" || node.kind === "panel" || node.kind === "card")) {
    node.html = sanitize(target.innerHTML);
    return;
  }
  if (field === "text" && target.isContentEditable) {
    if (node.kind === "heading" || node.kind === "quote") node.text = target.textContent ?? "";
    return;
  }
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  const value = target.value;
  if (node.kind === "heading" && field === "level") {
    node.level = value === "1" ? 1 : value === "3" ? 3 : 2;
    if (fromChange) rerenderArticle(form, node.uid);
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
  }
}

function onClick(form: HTMLFormElement, event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const state = mounted.get(form);
  if (!state) return;
  const palette = target.closest<HTMLElement>("[data-palette]");
  if (palette?.dataset.palette) {
    event.preventDefault();
    if (suppressClick) return;
    appendPalette(form, palette.dataset.palette);
    return;
  }
  const command = target.closest<HTMLElement>("[data-cmd]");
  if (command?.dataset.cmd) {
    event.preventDefault();
    runCommand(form, command.dataset.cmd);
    return;
  }
  const list = target.closest<HTMLElement>("[data-list]");
  if (list) {
    event.preventDefault();
    toggleList(form, list);
    return;
  }
  const cols = target.closest<HTMLElement>("[data-cols]");
  if (cols?.dataset.cols) {
    event.preventDefault();
    setColumns(form, cols);
    return;
  }
  const remove = target.closest<HTMLElement>("[data-remove]");
  if (remove) {
    event.preventDefault();
    const article = remove.closest<HTMLElement>("[data-item-id]");
    const uid = article?.dataset.itemId;
    if (!uid) return;
    mark(form);
    for (const zone of state.zones) {
      if (removeNode(zone.items, uid)) renderZone(form, zone);
    }
  }
}

function appendPalette(form: HTMLFormElement, kind: string): void {
  const state = mounted.get(form);
  if (!state || !isPaletteKind(kind)) return;
  const zone = state.zones.find((item) => item.name === state.active) ?? state.zones[0];
  if (!zone) return;
  if (kind === "columns" && insideCell()) return;
  mark(form);
  syncAll(state);
  zone.items.push(toEdit(blankSection(kind)));
  renderZone(form, zone);
}

function runCommand(form: HTMLFormElement, command: string): void {
  mark(form);
  if (command === "link") {
    const href = window.prompt("Link address");
    if (!href || /^\s*javascript:/i.test(href)) return;
    document.execCommand("createLink", false, href);
    return;
  }
  if (command === "bold") document.execCommand("bold");
  if (command === "italic") document.execCommand("italic");
}

function toggleList(form: HTMLFormElement, button: HTMLElement): void {
  const state = mounted.get(form);
  const article = button.closest<HTMLElement>("[data-item-id]");
  const node = state && article ? findNode(allItems(state), article.dataset.itemId ?? "") : undefined;
  if (!state || !node || node.kind !== "text") return;
  mark(form);
  syncAll(state);
  if (node.tag === "p") {
    node.tag = "ul";
    node.html = node.html.includes("<li") ? node.html : `<li>${node.html}</li>`;
  } else {
    const holder = document.createElement("div");
    holder.innerHTML = node.html;
    node.tag = "p";
    node.html = escapeText(holder.textContent ?? "");
  }
  const zone = zoneOf(state, node.uid);
  if (zone) renderZone(form, zone);
}

function setColumns(form: HTMLFormElement, button: HTMLElement): void {
  const state = mounted.get(form);
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
  document.execCommand("insertHTML", false, html ? sanitize(html) : escapeText(text).replace(/\n/g, "<br>"));
}

function onDragStart(form: HTMLFormElement, event: DragEvent): void {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !event.dataTransfer) return;
  suppressClick = true;
  const palette = target.closest<HTMLElement>("[data-palette]");
  if (palette?.dataset.palette) {
    event.dataTransfer.setData("application/x-tessera-palette", palette.dataset.palette);
    event.dataTransfer.setData("text/plain", palette.dataset.palette);
    event.dataTransfer.effectAllowed = "copy";
    return;
  }
  const handle = target.closest<HTMLElement>("[data-drag]");
  const article = handle?.closest<HTMLElement>("[data-item-id]");
  const zone = article?.dataset.zone;
  if (!handle || !article?.dataset.itemId || !zone) return;
  event.dataTransfer.setData("application/x-tessera-item", `${zone}\t${article.dataset.itemId}`);
  event.dataTransfer.setData("text/plain", article.dataset.itemId);
  event.dataTransfer.effectAllowed = "move";
  event.stopPropagation();
}

function onDragOver(form: HTMLFormElement, event: DragEvent): void {
  const slot = resolveSlot(event.target, form);
  if (!slot) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  clearDrop(form);
  slot.classList.add("editor-drop-active");
}

function onDrop(form: HTMLFormElement, event: DragEvent): void {
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
      if (field.dataset.field === "html" && field.isContentEditable && (node.kind === "text" || node.kind === "panel" || node.kind === "card")) {
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
  if (node.kind === "heading" && field === "level") node.level = value === "1" ? 1 : value === "3" ? 3 : 2;
  if ((node.kind === "panel" || node.kind === "quote") && field === "tone" && isTone(value)) node.tone = value;
  if (node.kind === "quote" && field === "attribution") node.attribution = value;
  if (node.kind === "imgbox" && field === "src") node.src = value;
  if (node.kind === "imgbox" && field === "alt") node.alt = value;
  if (node.kind === "imgbox" && field === "caption") node.caption = value;
  if (node.kind === "card" && field === "title") node.title = value;
  if (node.kind === "insert" && field === "id") node.id = value.trim();
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
  return ["heading", "text", "panel", "quote", "imgbox", "card", "columns", "insert"].includes(kind);
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

const ALLOWED = new Set(["strong", "b", "em", "i", "a", "br", "ul", "ol", "li", "p"]);

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
