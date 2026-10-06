import { escapeHtml, fieldId } from "../dom.js";
import { iconButton, REORDER_ICONS } from "../editor-icons.js";

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
  footer: boolean;
  extra: Record<string, unknown>;
};

export type NavHeadingRow = {
  kind: "heading";
  heading: string;
  sidebar: boolean;
  topbar: boolean;
  footer: boolean;
  pageType: string;
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
  return { kind: "link", id: "", title: "", sidebar: true, topbar: false, footer: false, extra: {} };
}

export function newNavHeading(): NavHeadingRow {
  return {
    kind: "heading",
    heading: "",
    sidebar: true,
    topbar: false,
    footer: false,
    pageType: "",
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
    ? `<ul class="editor-nav-menu">${columnHead()}${rows
        .map((row, index) => (row.kind === "heading" ? headingHtml(row, index, pages) : linkHtml(row, index, pages)))
        .join("")}</ul>`
    : `<p class="editor-nav-empty">No menu entries yet.</p>`;
  return `<div class="editor-nav">
    ${body}
    <p class="editor-nav-add">
      <button type="button" class="w3-button w3-small w3-theme" data-nav-action="add-link">Add link</button>
      <button type="button" class="w3-button w3-small w3-white" data-nav-action="add-heading">Add heading</button>
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

function columnHead(): string {
  return `<li class="editor-nav-head" aria-hidden="true">
    <span></span>
    <span></span>
    <span>sidebar</span>
    <span>topbar</span>
    <span>footer</span>
    <span></span>
  </li>`;
}

function headingHtml(row: NavHeadingRow, index: number, pages: readonly PageChoice[]): string {
  const children = row.children.map((child, childIndex) => childHtml(child, index, childIndex, pages)).join("");
  return `<li class="editor-nav-item">
    ${hiddenValue(`nav-${index}-kind`, "heading")}
    ${hidden(`nav-${index}-extra`, row.extra)}
    ${hidden(`nav-${index}-sourceExtra`, row.sourceExtra)}
    ${hidden(`nav-${index}-rest`, row.rest)}
    <div class="editor-nav-line">
      ${menuInput(`nav-${index}-heading`, "Heading", row.heading, "editor-nav-page")}
      <div class="editor-nav-meta">
        ${tagInput(`nav-${index}-pageType`, "Type", row.pageType)}
        ${tagInput(`nav-${index}-itemsTag`, "Items", row.itemsTag)}
        <button type="button" class="w3-button w3-small w3-white" data-nav-action="add-child" data-nav-index="${index}">Add link</button>
      </div>
      ${placeFlags(`nav-${index}`, row)}
      ${rowActions(index)}
    </div>
    ${children ? `<ul class="editor-nav-children">${children}</ul>` : ""}
  </li>`;
}

function linkHtml(row: NavLinkRow, index: number, pages: readonly PageChoice[], child?: number): string {
  const prefix = child === undefined ? `nav-${index}` : `nav-${index}-child-${child}`;
  return `<li class="editor-nav-item${child === undefined ? "" : " editor-nav-child"}">
    ${child === undefined ? hiddenValue(`${prefix}-kind`, "link") : ""}
    ${hidden(`${prefix}-extra`, row.extra)}
    <div class="editor-nav-line">
      ${pageSelect(`${prefix}-id`, "Page", row.id, pages)}
      ${menuInput(`${prefix}-title`, "Title", row.title, "editor-nav-label")}
      ${placeFlags(prefix, row)}
      ${child === undefined ? rowActions(index) : childActions(index, child)}
    </div>
  </li>`;
}

function childHtml(row: NavLinkRow, index: number, child: number, pages: readonly PageChoice[]): string {
  return linkHtml(row, index, pages, child);
}

function placeFlags(prefix: string, row: { sidebar: boolean; topbar: boolean; footer: boolean }): string {
  return `${check(`${prefix}-sidebar`, "Sidebar", row.sidebar)}
    ${check(`${prefix}-topbar`, "Top bar", row.topbar)}
    ${check(`${prefix}-footer`, "Footer", row.footer)}`;
}

function rowActions(index: number): string {
  return actionIcons(index);
}

function childActions(index: number, child: number): string {
  return actionIcons(index, child);
}

function actionIcons(index: number, child?: number): string {
  const childAttr = child === undefined ? "" : ` data-nav-child="${child}"`;
  const suffix = child === undefined ? "" : "-child";
  return `<span class="editor-nav-actions">
    ${navIconButton(`up${suffix}`, "Up", REORDER_ICONS.up, index, childAttr)}
    ${navIconButton(`down${suffix}`, "Down", REORDER_ICONS.down, index, childAttr)}
    ${navIconButton(`remove${suffix}`, "Remove", REORDER_ICONS.remove, index, childAttr)}
  </span>`;
}

function navIconButton(action: string, label: string, icon: string, index: number, extraAttributes: string): string {
  return iconButton({
    className: "editor-nav-icon",
    label,
    actionAttribute: "data-nav-action",
    action,
    indexAttribute: "data-nav-index",
    index,
    icon,
    extraAttributes,
  });
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
  return `<select id="${id}" name="${escapeHtml(name)}" class="w3-select editor-nav-page" aria-label="${escapeHtml(label)}">${options}</select>`;
}

function menuInput(name: string, label: string, value: string, className: string): string {
  const id = fieldId(name);
  return `<input id="${id}" name="${escapeHtml(name)}" class="w3-input ${className}" aria-label="${escapeHtml(label)}" placeholder="${escapeHtml(label)}" value="${escapeHtml(value)}" />`;
}

function tagInput(name: string, label: string, value: string): string {
  const id = fieldId(name);
  return `<label class="editor-nav-tag" for="${id}">${escapeHtml(label)}
    <input id="${id}" name="${escapeHtml(name)}" class="w3-input" aria-label="${escapeHtml(label)}" value="${escapeHtml(value)}" />
  </label>`;
}

function check(name: string, label: string, checked: boolean): string {
  const id = fieldId(name);
  return `<label class="editor-nav-flag" for="${id}"><input id="${id}" name="${escapeHtml(name)}" type="checkbox" aria-label="${escapeHtml(label)}"${checked ? " checked" : ""} /></label>`;
}

function hidden(name: string, value: unknown): string {
  return hiddenValue(name, JSON.stringify(value ?? {}));
}

function hiddenValue(name: string, value: string): string {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`;
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
      topbar: raw.fields.get("topbar")?.checked === true,
      footer: raw.fields.get("footer")?.checked === true,
      pageType: raw.fields.get("pageType")?.value ?? "",
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
    footer: fields.get("footer")?.checked === true,
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
    if (key === "id" || key === "title" || key === "sidebar" || key === "topbar" || key === "footer") continue;
    extra[key] = value;
  }
  return {
    kind: "link",
    id,
    title: typeof entry.title === "string" ? entry.title : "",
    sidebar: entry.sidebar === true,
    topbar: entry.topbar === true,
    footer: entry.footer === true,
    extra,
  };
}

function headingRow(entry: Record<string, unknown>, heading: string): NavHeadingRow {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (key === "heading" || key === "sidebar" || key === "topbar" || key === "footer" || key === "source" || key === "children") continue;
    extra[key] = value;
  }
  let pageType = "";
  let itemsTag = "";
  const sourceExtra: Record<string, unknown> = {};
  if (isRecord(entry.source)) {
    for (const [key, value] of Object.entries(entry.source)) {
      if (key === "pageType" && typeof value === "string") pageType = value;
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
    topbar: entry.topbar === true,
    footer: entry.footer === true,
    pageType,
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
  writePlace(out, row);
  if (!out.id && !out.title && Object.keys(row.extra).length === 0) return undefined;
  return out;
}

function serializeHeading(row: NavHeadingRow): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = copy(row.extra);
  if (row.heading) out.heading = row.heading;
  else delete out.heading;
  writePlace(out, row);
  const source: Record<string, unknown> = copy(row.sourceExtra);
  const pageType = row.pageType.trim();
  const itemsTag = row.itemsTag.trim();
  if (pageType) source.pageType = pageType;
  else delete source.pageType;
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

function writePlace(out: Record<string, unknown>, row: { sidebar: boolean; topbar: boolean; footer: boolean }): void {
  if (row.sidebar) out.sidebar = true;
  else delete out.sidebar;
  if (row.topbar) out.topbar = true;
  else delete out.topbar;
  if (row.footer) out.footer = true;
  else delete out.footer;
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
