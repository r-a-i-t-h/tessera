import type { NavSource } from "@r-a-i-t-h/tessera-model";

export type NavBuildLink = {
  kind: "link";
  id: string;
  title: string;
  sidebar: boolean;
  topbar: boolean;
  footer: boolean;
  source?: NavSource;
  extra: Record<string, unknown>;
};

export type NavBuildGroup = {
  kind: "group";
  heading: string;
  sidebar: boolean;
  topbar: boolean;
  footer: boolean;
  source?: NavSource;
  children: NavBuildNode[];
  extra: Record<string, unknown>;
};

export type NavBuildNode = NavBuildLink | NavBuildGroup;

export type NavPaletteKind =
  | { kind: "heading" }
  | { kind: "page"; id: string; title?: string }
  | { kind: "blog"; id: string; title?: string }
  | { kind: "type"; typeId: string }
  | { kind: "tag"; tag: string };

const PLACE_KEYS = new Set(["sidebar", "topbar", "footer"]);
const LINK_KEYS = new Set(["id", "title", ...PLACE_KEYS]);
const GROUP_KEYS = new Set(["heading", "children", "source", ...PLACE_KEYS]);

export function parseNavTree(data: unknown): NavBuildNode[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isRecord).map(entryFromRecord).filter(isPresent);
}

export function serializeNavTree(nodes: readonly NavBuildNode[]): unknown[] {
  const out: unknown[] = [];
  for (const node of nodes) {
    const entry = serializeNode(node);
    if (entry) out.push(entry);
  }
  return out;
}

export function paletteKindIsGroup(kind: NavPaletteKind): boolean {
  return kind.kind === "heading" || kind.kind === "type" || kind.kind === "tag";
}

export function nodeFromPalette(item: NavPaletteKind): NavBuildNode {
  switch (item.kind) {
    case "heading":
      return newGroup("");
    case "page":
      return newLink(item.id, item.title);
    case "blog":
      return {
        ...newLink(item.id, item.title),
        source: { blog: true },
      };
    case "type":
      return {
        ...newGroup(`Pages: ${item.typeId}`),
        source: { pageType: item.typeId },
      };
    case "tag":
      return {
        ...newGroup(`Tag: ${item.tag}`),
        source: { itemsTag: item.tag },
      };
  }
}

export function newLink(id = "", title = ""): NavBuildLink {
  return { kind: "link", id, title, sidebar: true, topbar: false, footer: false, extra: {} };
}

export function newGroup(heading = ""): NavBuildGroup {
  return {
    kind: "group",
    heading,
    sidebar: true,
    topbar: false,
    footer: false,
    children: [],
    extra: {},
  };
}

export function groupHeadingPlaceholder(node: NavBuildGroup): string {
  if (node.source?.pageType) return `Pages: ${node.source.pageType}`;
  if (node.source?.itemsTag) return `Tag: ${node.source.itemsTag}`;
  return "Heading";
}

export function setGroupHeading(roots: NavBuildNode[], path: number[], heading: string): NavBuildNode[] {
  const copy = structuredClone(roots);
  const node = getNode(copy, path);
  if (!node || node.kind !== "group") return roots;
  node.heading = heading;
  return copy;
}

export function nodeLabel(node: NavBuildNode, pageTitles?: ReadonlyMap<string, string>): string {
  if (node.kind === "link") {
    const id = node.id.trim();
    const navTitle = node.title.trim();
    const siteTitle = id ? pageTitles?.get(id) : undefined;
    return siteTitle || navTitle || id || "Link";
  }
  const head = node.heading.trim();
  if (head) return head;
  if (node.source?.pageType) return `Pages: ${node.source.pageType}`;
  if (node.source?.itemsTag) return `Tag: ${node.source.itemsTag}`;
  return "Group";
}

export function acceptsChildren(node: NavBuildNode): boolean {
  return node.kind === "group";
}

export function pathKey(path: number[]): string {
  return path.join(".");
}

export function parsePath(key: string): number[] {
  if (!key) return [];
  return key.split(".").map((part) => Number(part));
}

export function getNode(roots: readonly NavBuildNode[], path: number[]): NavBuildNode | undefined {
  if (!path.length) return undefined;
  let list: readonly NavBuildNode[] = roots;
  let current: NavBuildNode | undefined;
  for (let i = 0; i < path.length; i++) {
    current = list[path[i]!];
    if (!current) return undefined;
    if (i < path.length - 1) {
      if (current.kind !== "group") return undefined;
      list = current.children;
    }
  }
  return current;
}

export function childList(node: NavBuildNode): NavBuildNode[] | undefined {
  return node.kind === "group" ? node.children : undefined;
}

export function insertNodes(
  roots: NavBuildNode[],
  parent: number[],
  index: number,
  nodes: NavBuildNode[],
): NavBuildNode[] {
  if (!nodes.length) return roots.slice();
  const copy = structuredClone(roots);
  const list = childrenRef(copy, parent);
  if (!list) return roots;
  const at = Math.max(0, Math.min(index, list.length));
  list.splice(at, 0, ...nodes.map((n) => structuredClone(n)));
  return copy;
}

export function removeNode(
  roots: NavBuildNode[],
  path: number[],
): { ok: true; roots: NavBuildNode[]; removed: NavBuildNode } | { ok: false; error: string } {
  if (!path.length) return { ok: false, error: "Missing path." };
  const node = getNode(roots, path);
  if (!node) return { ok: false, error: "That entry is gone." };
  const parent = path.slice(0, -1);
  const index = path[path.length - 1]!;
  const copy = structuredClone(roots);
  const list = childrenRef(copy, parent);
  if (!list || list[index] === undefined) return { ok: false, error: "That entry is gone." };
  const [removed] = list.splice(index, 1);
  return { ok: true, roots: copy, removed: removed! };
}

export function relocate(roots: NavBuildNode[], from: number[], parent: number[], index: number): NavBuildNode[] {
  if (!from.length) return roots.slice();
  if (pathsEqual(parent, from) || pathStartsWith(parent, from)) return roots.slice();
  const removed = removeNode(roots, from);
  if (!removed.ok) return roots.slice();
  let dest = index;
  if (pathsEqual(from.slice(0, -1), parent) && from[from.length - 1]! < index) dest -= 1;
  return insertNodes(removed.roots, adjustPath(parent, from), Math.max(0, dest), [removed.removed]);
}

export function moveSibling(roots: NavBuildNode[], path: number[], dir: -1 | 1): NavBuildNode[] {
  if (!path.length) return roots.slice();
  const index = path[path.length - 1]!;
  const parent = path.slice(0, -1);
  const host = parent.length === 0 ? undefined : getNode(roots, parent);
  const list = parent.length === 0 ? roots : host ? childList(host) : undefined;
  if (!list) return roots.slice();
  if (dir < 0) {
    if (index <= 0) return roots.slice();
    return relocate(roots, path, parent, index - 1);
  }
  if (index >= list.length - 1) return roots.slice();
  return relocate(roots, path, parent, index + 2);
}

function entryFromRecord(entry: Record<string, unknown>): NavBuildNode | undefined {
  const id = typeof entry.id === "string" ? entry.id : "";
  if (isNavGroupEntry(entry, id)) return groupFromRecord(entry);
  return linkFromRecord(entry, id);
}

function linkFromRecord(entry: Record<string, unknown>, id: string): NavBuildLink {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (LINK_KEYS.has(key) || key === "source") continue;
    extra[key] = value;
  }
  let source: NavSource | undefined;
  if (isRecord(entry.source)) source = parseSource(entry.source);
  return {
    kind: "link",
    id,
    title: typeof entry.title === "string" ? entry.title : "",
    sidebar: entry.sidebar === true,
    topbar: entry.topbar === true,
    footer: entry.footer === true,
    source,
    extra,
  };
}

function groupFromRecord(entry: Record<string, unknown>): NavBuildGroup {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (GROUP_KEYS.has(key)) continue;
    extra[key] = value;
  }
  const children: NavBuildNode[] = [];
  if (Array.isArray(entry.children)) {
    for (const child of entry.children) {
      if (!isRecord(child)) continue;
      const parsed = entryFromRecord(child);
      if (parsed) children.push(parsed);
    }
  }
  return {
    kind: "group",
    heading: typeof entry.heading === "string" ? entry.heading : "",
    sidebar: entry.sidebar === true,
    topbar: entry.topbar === true,
    footer: entry.footer === true,
    source: isRecord(entry.source) ? parseSource(entry.source) : undefined,
    children,
    extra,
  };
}

function parseSource(source: Record<string, unknown>): NavSource {
  const out: NavSource = {};
  if (typeof source.pageType === "string" && source.pageType) out.pageType = source.pageType;
  if (typeof source.itemsTag === "string" && source.itemsTag) out.itemsTag = source.itemsTag;
  if (source.blog === true) out.blog = true;
  for (const [key, value] of Object.entries(source)) {
    if (key === "pageType" || key === "itemsTag" || key === "blog") continue;
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

function serializeNode(node: NavBuildNode): Record<string, unknown> | undefined {
  if (node.kind === "link") return serializeLink(node);
  return serializeGroup(node);
}

function serializeLink(row: NavBuildLink): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = copy(row.extra);
  if (row.id) out.id = row.id;
  else delete out.id;
  if (row.title) out.title = row.title;
  else delete out.title;
  writePlace(out, row);
  const source = cleanSource(row.source);
  if (source) out.source = source;
  else delete out.source;
  if (!out.id && !out.title && !out.source && Object.keys(row.extra).length === 0) return undefined;
  return out;
}

function serializeGroup(row: NavBuildGroup): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = copy(row.extra);
  if (row.heading) out.heading = row.heading;
  else delete out.heading;
  writePlace(out, row);
  const source = cleanSource(row.source);
  if (source) out.source = source;
  else delete out.source;
  const children = row.children.map(serializeNode).filter(isPresent);
  if (children.length) out.children = children;
  else delete out.children;
  if (!out.heading && !out.source && !out.children && Object.keys(row.extra).length === 0) return undefined;
  return out;
}

function cleanSource(source: NavSource | undefined): NavSource | undefined {
  if (!source) return undefined;
  const out: NavSource = { ...source };
  if (!out.pageType) delete out.pageType;
  if (!out.itemsTag) delete out.itemsTag;
  if (!out.blog) delete out.blog;
  if (!Object.keys(out).length) return undefined;
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

function isNavGroupEntry(entry: Record<string, unknown>, id: string): boolean {
  if (id) return false;
  if ("heading" in entry) return true;
  if (entry.source !== undefined && entry.source !== null) return true;
  return Array.isArray(entry.children) && entry.children.length > 0;
}

function childrenRef(roots: NavBuildNode[], parent: number[]): NavBuildNode[] | undefined {
  if (!parent.length) return roots;
  const host = getNode(roots, parent);
  if (!host || host.kind !== "group") return undefined;
  return host.children;
}

function pathsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function pathStartsWith(path: number[], prefix: number[]): boolean {
  if (prefix.length > path.length) return false;
  return prefix.every((value, index) => path[index] === value);
}

function adjustPath(path: number[], removedFrom: number[]): number[] {
  if (!pathStartsWith(path, removedFrom.slice(0, -1))) return path.slice();
  const removedIndex = removedFrom[removedFrom.length - 1]!;
  const at = path[removedFrom.length - 1];
  if (at === undefined) return path.slice();
  if (path.length === removedFrom.length && at > removedIndex) {
    return path.slice(0, -1).concat(at - 1);
  }
  if (path.length > removedFrom.length && at > removedIndex) {
    const next = path.slice();
    next[removedFrom.length - 1] = at - 1;
    return next;
  }
  return path.slice();
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
