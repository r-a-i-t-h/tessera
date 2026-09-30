export type PageChoice = { id: string; title?: string };

export type ControlValue = {
  name: string;
  value: string;
  checked?: boolean;
};

export type NavLinkRow = {
  kind: "link";
  id: string;
  title: string;
  sidebar: boolean;
  topbar: boolean;
  extra: Record<string, unknown>;
};

export type NavHeadingRow = {
  kind: "heading";
  heading: string;
  sidebar: boolean;
  pagesTag: string;
  itemsTag: string;
  sourceExtra: Record<string, unknown>;
  children: NavLinkRow[];
  /** Children the list does not edit (for example a nested heading). */
  rest: unknown[];
  extra: Record<string, unknown>;
};

export type NavRow = NavLinkRow | NavHeadingRow;

export type NavAction =
  | "add-link"
  | "add-heading"
  | "remove"
  | "up"
  | "down"
  | "add-child"
  | "remove-child"
  | "up-child"
  | "down-child";

const NAV_ACTIONS: readonly NavAction[] = [
  "add-link",
  "add-heading",
  "remove",
  "up",
  "down",
  "add-child",
  "remove-child",
  "up-child",
  "down-child",
];

export function isNavAction(value: string): value is NavAction {
  return (NAV_ACTIONS as readonly string[]).includes(value);
}

const NAME = /^nav-(\d+)(?:-child-(\d+))?-(.+)$/;

export function newNavLink(): NavLinkRow {
  return { kind: "link", id: "", title: "", sidebar: true, topbar: false, extra: {} };
}

export function newNavHeading(): NavHeadingRow {
  return {
    kind: "heading",
    heading: "",
    sidebar: true,
    pagesTag: "",
    itemsTag: "",
    sourceExtra: {},
    children: [],
    rest: [],
    extra: {},
  };
}

export function navRows(data: unknown): NavRow[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isRecord).map(rowFromEntry);
}

export function navEntries(rows: readonly NavRow[]): unknown[] {
  const entries: unknown[] = [];
  for (const row of rows) {
    const entry = row.kind === "heading" ? serializeHeading(row) : serializeLink(row);
    if (entry) entries.push(entry);
  }
  return entries;
}

export function applyNavAction(rows: readonly NavRow[], action: NavAction, index = 0, child = 0): NavRow[] {
  if (action === "add-link") return [...rows, newNavLink()];
  if (action === "add-heading") return [...rows, newNavHeading()];
  if (action === "remove") return rows.filter((_, i) => i !== index);
  if (action === "up") return moveItem(rows, index, -1);
  if (action === "down") return moveItem(rows, index, 1);
  if (action === "add-child") {
    return mapHeading(rows, index, (row) => ({ ...row, children: [...row.children, newNavLink()] }));
  }
  if (action === "remove-child") {
    return mapHeading(rows, index, (row) => ({
      ...row,
      children: row.children.filter((_, i) => i !== child),
    }));
  }
  if (action === "up-child") {
    return mapHeading(rows, index, (row) => ({ ...row, children: moveItem(row.children, child, -1) }));
  }
  if (action === "down-child") {
    return mapHeading(rows, index, (row) => ({ ...row, children: moveItem(row.children, child, 1) }));
  }
  return [...rows];
}

export function renderNavList(rows: readonly NavRow[], pages: readonly PageChoice[]): string {
  const body = rows.length
    ? rows.map((row, index) => (row.kind === "heading" ? headingHtml(row, index, pages) : linkHtml(row, index, pages))).join("")
    : `<p class="w3-text-grey">No menu entries yet.</p>`;
  return `<div class="editor-nav">
    <p class="w3-text-grey">Checked sidebar entries appear in the menu. A heading can group links, or include pages and items that share a tag.</p>
    ${body}
    <p class="editor-nav-actions">
      <button type="button" class="w3-button w3-theme" data-nav-action="add-link">Add link</button>
      <button type="button" class="w3-button w3-white" data-nav-action="add-heading">Add heading</button>
    </p>
  </div>`;
}

export function rowsFromControls(controls: readonly ControlValue[]): NavRow[] {
  const tops = new Map<number, RawRow>();
  for (const control of controls) {
    const match = NAME.exec(control.name);
    if (!match) continue;
    const index = Number(match[1]);
    const field = match[3] ?? "";
    const row = tops.get(index) ?? { fields: new Map(), children: new Map() };
    tops.set(index, row);
    if (match[2] === undefined) {
      row.fields.set(field, control);
      continue;
    }
    const childIndex = Number(match[2]);
    const child = row.children.get(childIndex) ?? new Map<string, ControlValue>();
    child.set(field, control);
    row.children.set(childIndex, child);
  }
  return [...tops.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => rawToRow(row));
}

function headingHtml(row: NavHeadingRow, index: number, pages: readonly PageChoice[]): string {
  const children = row.children.length
    ? row.children.map((child, childIndex) => childHtml(child, index, childIndex, pages)).join("")
    : `<p class="w3-text-grey">No links under this heading.</p>`;
  return `<article class="editor-nav-row">
    <h3 class="w3-medium">Heading</h3>
    ${hiddenValue(`nav-${index}-kind`, "heading")}
    ${hidden(`nav-${index}-extra`, row.extra)}
    ${hidden(`nav-${index}-sourceExtra`, row.sourceExtra)}
    ${hidden(`nav-${index}-rest`, row.rest)}
    ${textInput(`nav-${index}-heading`, "Heading", row.heading)}
    <p class="editor-nav-flags">${check(`nav-${index}-sidebar`, "Sidebar", row.sidebar)}</p>
    ${textInput(`nav-${index}-pagesTag`, "Pages with tag", row.pagesTag)}
    ${textInput(`nav-${index}-itemsTag`, "Items with tag", row.itemsTag)}
    <div class="editor-nav-children">
      <h4 class="w3-small">Links under this heading</h4>
      ${children}
      <p><button type="button" class="w3-button w3-small w3-white" data-nav-action="add-child" data-nav-index="${index}">Add link</button></p>
    </div>
    ${rowActions(index)}
  </article>`;
}

function linkHtml(row: NavLinkRow, index: number, pages: readonly PageChoice[], child?: number): string {
  const prefix = child === undefined ? `nav-${index}` : `nav-${index}-child-${child}`;
  return `<article class="editor-nav-row${child === undefined ? "" : " editor-nav-child"}">
    <h3 class="w3-medium">Link</h3>
    ${child === undefined ? hiddenValue(`${prefix}-kind`, "link") : ""}
    ${hidden(`${prefix}-extra`, row.extra)}
    ${pageSelect(`${prefix}-id`, "Page", row.id, pages)}
    ${textInput(`${prefix}-title`, "Title", row.title)}
    <p class="editor-nav-flags">
      ${check(`${prefix}-sidebar`, "Sidebar", row.sidebar)}
      ${check(`${prefix}-topbar`, "Top bar", row.topbar)}
    </p>
    ${child === undefined ? rowActions(index) : childActions(index, child)}
  </article>`;
}

function childHtml(row: NavLinkRow, index: number, child: number, pages: readonly PageChoice[]): string {
  return linkHtml(row, index, pages, child);
}

function rowActions(index: number): string {
  return `<p class="editor-nav-actions">
    <button type="button" class="w3-button w3-small w3-white" data-nav-action="up" data-nav-index="${index}">Up</button>
    <button type="button" class="w3-button w3-small w3-white" data-nav-action="down" data-nav-index="${index}">Down</button>
    <button type="button" class="w3-button w3-small w3-white" data-nav-action="remove" data-nav-index="${index}">Remove</button>
  </p>`;
}

function childActions(index: number, child: number): string {
  return `<p class="editor-nav-actions">
    <button type="button" class="w3-button w3-small w3-white" data-nav-action="up-child" data-nav-index="${index}" data-nav-child="${child}">Up</button>
    <button type="button" class="w3-button w3-small w3-white" data-nav-action="down-child" data-nav-index="${index}" data-nav-child="${child}">Down</button>
    <button type="button" class="w3-button w3-small w3-white" data-nav-action="remove-child" data-nav-index="${index}" data-nav-child="${child}">Remove</button>
  </p>`;
}

function pageSelect(name: string, label: string, current: string, pages: readonly PageChoice[]): string {
  const id = fieldId(name);
  const known = pages.some((page) => page.id === current);
  const choices = !current || known ? pages : [{ id: current, title: current }, ...pages];
  const options = [
    `<option value=""${!current ? " selected" : ""}>Choose a page</option>`,
    ...choices.map((page) => {
      const text = page.title && page.title !== page.id ? `${page.title} (${page.id})` : page.id;
      return `<option value="${escapeHtml(page.id)}"${page.id === current ? " selected" : ""}>${escapeHtml(text)}</option>`;
    }),
  ].join("");
  return `<p><label for="${id}">${escapeHtml(label)}</label>
    <select id="${id}" name="${escapeHtml(name)}" class="w3-select w3-border w3-margin-top">${options}</select></p>`;
}

function textInput(name: string, label: string, value: string): string {
  const id = fieldId(name);
  return `<p><label for="${id}">${escapeHtml(label)}</label>
    <input id="${id}" name="${escapeHtml(name)}" class="w3-input w3-border w3-margin-top" value="${escapeHtml(value)}" /></p>`;
}

function check(name: string, label: string, checked: boolean): string {
  const id = fieldId(name);
  return `<label class="editor-check" for="${id}"><input id="${id}" name="${escapeHtml(name)}" type="checkbox"${checked ? " checked" : ""} /> ${escapeHtml(label)}</label>`;
}

function hidden(name: string, value: unknown): string {
  return hiddenValue(name, JSON.stringify(value ?? {}));
}

function hiddenValue(name: string, value: string): string {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`;
}

function fieldId(name: string): string {
  return `f-${name.replace(/[^a-zA-Z0-9]+/g, "-")}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type RawRow = {
  fields: Map<string, ControlValue>;
  children: Map<number, Map<string, ControlValue>>;
};

function rawToRow(raw: RawRow): NavRow {
  if (raw.fields.get("kind")?.value === "heading") {
    const children = [...raw.children.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, fields]) => draftLink(fields));
    return {
      kind: "heading",
      heading: raw.fields.get("heading")?.value ?? "",
      sidebar: raw.fields.get("sidebar")?.checked === true,
      pagesTag: raw.fields.get("pagesTag")?.value ?? "",
      itemsTag: raw.fields.get("itemsTag")?.value ?? "",
      sourceExtra: parseObject(raw.fields.get("sourceExtra")?.value ?? ""),
      children,
      rest: parseArray(raw.fields.get("rest")?.value ?? ""),
      extra: parseObject(raw.fields.get("extra")?.value ?? ""),
    };
  }
  return draftLink(raw.fields);
}

function draftLink(fields: Map<string, ControlValue>): NavLinkRow {
  return {
    kind: "link",
    id: fields.get("id")?.value ?? "",
    title: fields.get("title")?.value ?? "",
    sidebar: fields.get("sidebar")?.checked === true,
    topbar: fields.get("topbar")?.checked === true,
    extra: parseObject(fields.get("extra")?.value ?? ""),
  };
}

function rowFromEntry(entry: Record<string, unknown>): NavRow {
  const id = typeof entry.id === "string" ? entry.id : "";
  const heading = typeof entry.heading === "string" ? entry.heading : "";
  if (heading && !id) return headingRow(entry, heading);
  return linkRow(entry, id);
}

function linkRow(entry: Record<string, unknown>, id: string): NavLinkRow {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (key === "id" || key === "title" || key === "sidebar" || key === "topbar") continue;
    extra[key] = value;
  }
  return {
    kind: "link",
    id,
    title: typeof entry.title === "string" ? entry.title : "",
    sidebar: entry.sidebar === true,
    topbar: entry.topbar === true,
    extra,
  };
}

function headingRow(entry: Record<string, unknown>, heading: string): NavHeadingRow {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (key === "heading" || key === "sidebar" || key === "source" || key === "children") continue;
    extra[key] = value;
  }
  let pagesTag = "";
  let itemsTag = "";
  const sourceExtra: Record<string, unknown> = {};
  if (isRecord(entry.source)) {
    for (const [key, value] of Object.entries(entry.source)) {
      if (key === "pagesTag" && typeof value === "string") pagesTag = value;
      else if (key === "itemsTag" && typeof value === "string") itemsTag = value;
      else sourceExtra[key] = value;
    }
  } else if (entry.source !== undefined) {
    extra.source = entry.source;
  }
  const children: NavLinkRow[] = [];
  const rest: unknown[] = [];
  if (Array.isArray(entry.children)) {
    for (const child of entry.children) {
      if (!isRecord(child)) {
        rest.push(child);
        continue;
      }
      const childId = typeof child.id === "string" ? child.id : "";
      const childHeading = typeof child.heading === "string" ? child.heading : "";
      if (childHeading && !childId) rest.push(child);
      else children.push(linkRow(child, childId));
    }
  } else if (entry.children !== undefined) {
    extra.children = entry.children;
  }
  return {
    kind: "heading",
    heading,
    sidebar: entry.sidebar === true,
    pagesTag,
    itemsTag,
    sourceExtra,
    children,
    rest,
    extra,
  };
}

function serializeLink(row: NavLinkRow): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = copy(row.extra);
  if (row.id) out.id = row.id;
  else delete out.id;
  if (row.title) out.title = row.title;
  else delete out.title;
  if (row.sidebar) out.sidebar = true;
  else delete out.sidebar;
  if (row.topbar) out.topbar = true;
  else delete out.topbar;
  if (!out.id && !out.title && Object.keys(row.extra).length === 0) return undefined;
  return out;
}

function serializeHeading(row: NavHeadingRow): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = copy(row.extra);
  if (row.heading) out.heading = row.heading;
  else delete out.heading;
  if (row.sidebar) out.sidebar = true;
  else delete out.sidebar;
  const source: Record<string, unknown> = copy(row.sourceExtra);
  const pagesTag = row.pagesTag.trim();
  const itemsTag = row.itemsTag.trim();
  if (pagesTag) source.pagesTag = pagesTag;
  else delete source.pagesTag;
  if (itemsTag) source.itemsTag = itemsTag;
  else delete source.itemsTag;
  if (Object.keys(source).length) out.source = source;
  else delete out.source;
  const children = [...row.children.map(serializeLink).filter(isPresent), ...row.rest];
  if (children.length) out.children = children;
  else delete out.children;
  if (!out.heading && !out.source && !out.children && Object.keys(row.extra).length === 0) return undefined;
  return out;
}

function mapHeading(rows: readonly NavRow[], index: number, update: (row: NavHeadingRow) => NavHeadingRow): NavRow[] {
  return rows.map((row, i) => (i === index && row.kind === "heading" ? update(row) : row));
}

function moveItem<T>(items: readonly T[], index: number, delta: number): T[] {
  const next = index + delta;
  if (index < 0 || index >= items.length || next < 0 || next >= items.length) return [...items];
  const copyItems = items.slice();
  const [item] = copyItems.splice(index, 1);
  copyItems.splice(next, 0, item as T);
  return copyItems;
}

function parseObject(text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  try {
    const value = JSON.parse(text) as unknown;
    if (isRecord(value)) return value;
  } catch {
    return {};
  }
  return {};
}

function parseArray(text: string): unknown[] {
  if (!text.trim()) return [];
  try {
    const value = JSON.parse(text) as unknown;
    if (Array.isArray(value)) return value;
  } catch {
    return [];
  }
  return [];
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}
