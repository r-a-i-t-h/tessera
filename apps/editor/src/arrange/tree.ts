import { LayoutNodeSchema, type LayoutComponentNode, type LayoutNode, type RegionNode } from "@r-a-i-t-h/tessera-model";

export const REGION_TAGS = ["div", "header", "nav", "main", "footer", "aside", "section", "article", "h1"] as const;

export const MENU_SHAPES = [
  { name: "navFlat", label: "Flat list" },
  { name: "navTree", label: "Nested" },
  { name: "navCollapse", label: "Sections" },
  { name: "navTags", label: "By tag" },
  { name: "pageNav", label: "Pages with no type" },
] as const;

export const COMPONENT_CHOICES = [
  ...MENU_SHAPES,
  { name: "breadcrumbs", label: "Breadcrumbs" },
  { name: "subpageList", label: "Subpages" },
  { name: "linkCluster", label: "Link cluster" },
] as const;

const SCOPED_MENUS = new Set(["navFlat", "navTree", "navCollapse"]);
const KNOWN_PROPS = ["scope", "tag", "title", "variant", "source", "type", "heading"] as const;

const MENU_BUTTON =
  '<a class="w3-bar-item w3-button tessera-menu-btn w3-hide-large" href="javascript:void(0)" onclick="w3_open()" aria-label="Open menu">Menu</a><div class="w3-bar-item tessera-brand">Site</div>';
const FONT_BUTTONS =
  '<span class="tessera-fonts" role="group" aria-label="Font"><button type="button" class="tessera-font-btn" onclick="body_switch.switch(&quot;font&quot;, 0)">A</button><button type="button" class="tessera-font-btn" onclick="body_switch.switch(&quot;font&quot;, 1)">B</button><button type="button" class="tessera-font-btn" onclick="body_switch.switch(&quot;font&quot;, 2)">C</button><button type="button" class="tessera-font-btn" onclick="body_switch.switch(&quot;font&quot;, 3)">D</button></span>';
const CLOSE_BUTTON =
  '<a href="javascript:void(0)" onclick="w3_close()" class="w3-button w3-right w3-hide-large" aria-label="Close menu">Close</a>';
const OVERLAY = '<div class="w3-overlay w3-hide-large" onclick="w3_close()" id="myOverlay"></div>';

export type PaletteId =
  | "region"
  | "topbar"
  | "fonts"
  | "menu"
  | "sidemenu"
  | "breadcrumbs"
  | "page"
  | "footer"
  | "html"
  | "zone"
  | "columns2"
  | "columns3"
  | "heading"
  | "component";

export type PaletteItem = { id: PaletteId; label: string };

export function asLayoutNode(value: unknown): LayoutNode | undefined {
  const parsed = LayoutNodeSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function isFrame(root: LayoutNode): boolean {
  return countKind(root, "page") > 0;
}

export function paletteFor(frame: boolean): PaletteItem[] {
  if (frame) {
    return [
      { id: "region", label: "Region" },
      { id: "topbar", label: "Top bar" },
      { id: "fonts", label: "Font buttons" },
      { id: "sidemenu", label: "Side menu" },
      { id: "menu", label: "Menu" },
      { id: "breadcrumbs", label: "Breadcrumbs" },
      { id: "page", label: "Page" },
      { id: "footer", label: "Footer" },
      { id: "html", label: "Custom HTML" },
    ];
  }
  return [
    { id: "region", label: "Region" },
    { id: "zone", label: "Zone" },
    { id: "columns2", label: "Two columns" },
    { id: "columns3", label: "Three columns" },
    { id: "heading", label: "Heading" },
    { id: "component", label: "Component" },
    { id: "html", label: "Custom HTML" },
  ];
}

export function nodesFor(id: PaletteId, root: LayoutNode): { ok: true; nodes: LayoutNode[] } | { ok: false; error: string } {
  if (id === "page" && countKind(root, "page") > 0) {
    return { ok: false, error: "This frame already has its page slot." };
  }
  if (id === "zone" && isFrame(root)) {
    return { ok: false, error: "A zone on the frame is not a Compose canvas. Add it on the page layout." };
  }
  return { ok: true, nodes: presetNodes(id, root) };
}

export function newPageLayout(id: string): { id: string; root: LayoutNode } {
  return {
    id,
    root: {
      type: "region",
      role: "main",
      children: [
        { type: "region", tag: "h1", className: "w3-text-theme", children: [{ type: "zone", id: "title" }] },
        { type: "zone", id: "main" },
      ],
    },
  };
}

export function newFrame(id: string): { id: string; root: LayoutNode } {
  return {
    id,
    root: {
      type: "region",
      children: [{ type: "region", tag: "main", children: [{ type: "page" }] }],
    },
  };
}

export function getNode(root: LayoutNode, path: number[]): LayoutNode | undefined {
  let current: LayoutNode | undefined = root;
  for (const index of path) {
    const kids: LayoutNode[] | undefined = current ? childList(current) : undefined;
    current = kids?.[index];
  }
  return current;
}

export function childList(node: LayoutNode): LayoutNode[] | undefined {
  if (node.type === "region") return node.children;
  if (node.type === "component") return node.children ?? [];
  return undefined;
}

export function acceptsChildren(node: LayoutNode): boolean {
  return node.type === "region" || node.type === "component";
}

export function updateNode(root: LayoutNode, path: number[], next: LayoutNode): LayoutNode {
  if (path.length === 0) return next;
  const host = getNode(root, path.slice(0, -1));
  if (!host) return root;
  const kids = childList(host);
  const index = path[path.length - 1]!;
  if (!kids || kids[index] === undefined) return root;
  const copy = kids.slice();
  copy[index] = next;
  const updated = withChildren(host, copy);
  if (path.length === 1) return updated;
  return updateNode(root, path.slice(0, -1), updated);
}

export function insertNodes(root: LayoutNode, parent: number[], index: number, nodes: LayoutNode[]): LayoutNode {
  if (!nodes.length) return root;
  const host = parent.length === 0 ? root : getNode(root, parent);
  if (!host || !acceptsChildren(host)) return root;
  const kids = (childList(host) ?? []).slice();
  const at = Math.max(0, Math.min(index, kids.length));
  kids.splice(at, 0, ...nodes.map((node) => structuredClone(node)));
  const updated = withChildren(host, kids);
  if (parent.length === 0) return updated;
  return updateNode(root, parent, updated);
}

export function removeNode(root: LayoutNode, path: number[]): { ok: true; root: LayoutNode } | { ok: false; error: string } {
  if (path.length === 0) return { ok: false, error: "The outer box stays." };
  const node = getNode(root, path);
  if (!node) return { ok: false, error: "That piece is gone." };
  if (node.type === "page" && countKind(root, "page") <= 1) {
    return { ok: false, error: "A frame keeps its page slot." };
  }
  const parent = path.slice(0, -1);
  const index = path[path.length - 1]!;
  const host = parent.length === 0 ? root : getNode(root, parent);
  if (!host) return { ok: false, error: "That piece is gone." };
  const kids = (childList(host) ?? []).slice();
  kids.splice(index, 1);
  const updated = withChildren(host, kids);
  const next = parent.length === 0 ? updated : updateNode(root, parent, updated);
  return { ok: true, root: next };
}

/** Move `from` so it becomes child `index` of `parent` (a gap index, including the end). */
export function relocate(root: LayoutNode, from: number[], parent: number[], index: number): LayoutNode {
  if (from.length === 0) return root;
  if (pathsEqual(parent, from) || pathStartsWith(parent, from)) return root;
  const node = getNode(root, from);
  if (!node) return root;
  const host = parent.length === 0 ? root : getNode(root, parent);
  if (!host || !acceptsChildren(host)) return root;
  const removed = removeNode(root, from);
  if (!removed.ok) return root;
  let dest = index;
  if (pathsEqual(from.slice(0, -1), parent) && from[from.length - 1]! < index) dest -= 1;
  return insertNodes(removed.root, adjustPath(parent, from), Math.max(0, dest), [node]);
}

export function moveSibling(root: LayoutNode, path: number[], dir: -1 | 1): LayoutNode {
  if (path.length === 0) return root;
  const index = path[path.length - 1]!;
  const parent = path.slice(0, -1);
  const host = parent.length === 0 ? root : getNode(root, parent);
  const kids = host ? childList(host) : undefined;
  if (!kids) return root;
  if (dir < 0) {
    if (index <= 0) return root;
    return relocate(root, path, parent, index - 1);
  }
  if (index >= kids.length - 1) return root;
  return relocate(root, path, parent, index + 2);
}

export function setExtraProps(node: LayoutNode, extra: Record<string, unknown>): LayoutNode {
  if (node.type !== "component") return node;
  return applyComponentField(node, "extraProps", JSON.stringify(extra));
}

export function applyField(node: LayoutNode, field: string, value: string): LayoutNode {
  if (node.type === "region") return applyRegionField(node, field, value);
  if (node.type === "zone") return applyZoneField(node, field, value);
  if (node.type === "static") return applyStaticField(node, field, value);
  if (node.type === "component") return applyComponentField(node, field, value);
  return node;
}

export function classTokens(className: string | undefined): string[] {
  return (className ?? "").split(/\s+/).filter(Boolean);
}

export function drawerState(node: LayoutNode): "open" | "closed" | undefined {
  if (node.type !== "region") return undefined;
  const tokens = classTokens(node.className);
  const sidebar = node.id === "mySidebar" || tokens.includes("w3-sidebar") || tokens.includes("wh-drawer");
  if (!sidebar) return undefined;
  return tokens.includes("w3-collapse") ? "open" : "closed";
}

export function stayOpenNote(node: LayoutNode): string | undefined {
  if (drawerState(node) !== "closed") return undefined;
  if (!classTokens(node.type === "region" ? node.className : undefined).includes("wh-drawer")) return undefined;
  return "Staying open also needs a margin rule for this drawer in shell/site.css. The guide has the recipe.";
}

export function columnWidth(className: string | undefined): string | undefined {
  return classTokens(className).find((token) => /^m(?:4|5|6|7|8)$/.test(token));
}

export function nodeLabel(node: LayoutNode): string {
  switch (node.type) {
    case "region": {
      const tag = node.tag && node.tag !== "div" ? node.tag : "";
      const name = tag || node.role || "Region";
      return node.id ? `${name} · ${node.id}` : name;
    }
    case "zone":
      return `${node.id} · zone`;
    case "page":
      return "Page";
    case "static":
      return staticLabel(node.html);
    case "component":
      return componentLabel(node);
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

export function nodeDetail(node: LayoutNode): string {
  switch (node.type) {
    case "page":
      return "Each page is drawn here.";
    case "zone":
      return "Filled on each page in Compose.";
    case "static": {
      const text = paragraphText(node.html);
      if (text) return text;
      const trimmed = node.html.replace(/\s+/g, " ").trim();
      return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
    }
    case "component":
      return node.name;
    case "region":
      return node.className ?? "";
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

export function paragraphText(html: string): string | undefined {
  const match = html.match(/^<p>([\s\S]*)<\/p>$/);
  if (!match || match[1]?.includes("<")) return undefined;
  return decodeText(match[1] ?? "");
}

export function scopeForParent(parent: LayoutNode | undefined): "sidebar" | "topbar" | "footer" | undefined {
  if (!parent || parent.type !== "region") return undefined;
  const tokens = classTokens(parent.className);
  if (parent.tag === "header" || tokens.some((token) => token === "wh-header" || token === "tessera-bar" || token === "wh-topnav" || token === "wh-brandbar")) {
    return "topbar";
  }
  if (parent.tag === "footer" || tokens.some((token) => token.includes("footer"))) return "footer";
  if (parent.id === "mySidebar" || tokens.includes("w3-sidebar") || tokens.includes("wh-drawer")) return "sidebar";
  return undefined;
}

export function componentNames(node: LayoutNode, into = new Set<string>()): Set<string> {
  if (node.type === "component") into.add(node.name);
  for (const child of childList(node) ?? []) componentNames(child, into);
  return into;
}

export function knownPropKeys(): readonly string[] {
  return KNOWN_PROPS;
}

export function extraProps(props: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!props) return {};
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!(KNOWN_PROPS as readonly string[]).includes(key)) extra[key] = value;
  }
  return extra;
}

export function cleanNode(node: LayoutNode): LayoutNode {
  switch (node.type) {
    case "region": {
      const next: RegionNode = { type: "region", children: node.children.map(cleanNode) };
      if (node.tag && node.tag !== "div") next.tag = node.tag;
      if (node.id?.trim()) next.id = node.id.trim();
      if (node.role?.trim()) next.role = node.role.trim();
      const className = node.className?.trim();
      if (className) next.className = className;
      return next;
    }
    case "zone": {
      const className = node.className?.trim();
      return { type: "zone", id: node.id.trim() || "zone", ...(className ? { className } : {}) };
    }
    case "static":
      return { type: "static", html: node.html };
    case "page":
      return { type: "page" };
    case "component": {
      const children = (node.children ?? []).map(cleanNode);
      const props = node.props ? cleanProps(node.props) : undefined;
      const next: LayoutComponentNode = { type: "component", name: node.name.trim() || "component" };
      if (props && Object.keys(props).length) next.props = props;
      if (children.length) next.children = children;
      return next;
    }
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

export function tagOptions(current: string | undefined): string[] {
  const tags: string[] = [...REGION_TAGS];
  if (current && !tags.includes(current)) tags.push(current);
  return tags;
}

export function pathKey(path: number[]): string {
  return path.join(".");
}

export function parsePath(key: string): number[] {
  if (!key) return [];
  return key.split(".").map((part) => Number(part));
}

function presetNodes(id: PaletteId, root: LayoutNode): LayoutNode[] {
  switch (id) {
    case "region":
      return [{ type: "region", children: [] }];
    case "topbar":
      return [
        {
          type: "region",
          tag: "header",
          className: "w3-bar tessera-bar",
          children: [{ type: "static", html: MENU_BUTTON }],
        },
      ];
    case "fonts":
      return [{ type: "static", html: FONT_BUTTONS }];
    case "menu":
      return [{ type: "component", name: "navFlat", props: { scope: "sidebar" } }];
    case "sidemenu":
      return [
        {
          type: "region",
          tag: "nav",
          id: "mySidebar",
          className: "w3-sidebar w3-bar-block w3-collapse tessera-sidebar",
          children: [
            { type: "static", html: CLOSE_BUTTON },
            { type: "component", name: "navFlat", props: { scope: "sidebar" } },
          ],
        },
        { type: "static", html: OVERLAY },
      ];
    case "breadcrumbs":
      return [{ type: "component", name: "breadcrumbs" }];
    case "page":
      return [{ type: "page" }];
    case "footer":
      return [
        {
          type: "region",
          tag: "footer",
          className: "tessera-footer",
          children: [{ type: "static", html: "<p>Footer</p>" }],
        },
      ];
    case "html":
      return [{ type: "static", html: "<p></p>" }];
    case "zone":
      return [{ type: "zone", id: freshZoneId(root) }];
    case "columns2":
      return [columns(["m6", "m6"])];
    case "columns3":
      return [columns(["m4", "m4", "m4"])];
    case "heading":
      return [{ type: "region", tag: "h1", className: "w3-text-theme", children: [] }];
    case "component":
      return [{ type: "component", name: "subpageList" }];
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

function columns(widths: string[]): LayoutNode {
  return {
    type: "region",
    role: "row",
    className: "w3-row-padding wh-split",
    children: widths.map((width) => ({ type: "region", className: `w3-col ${width}`, children: [] })),
  };
}

function freshZoneId(root: LayoutNode): string {
  const used = new Set<string>();
  walk(root, (node) => {
    if (node.type === "zone") used.add(node.id);
  });
  if (!used.has("main")) return "main";
  let n = 2;
  while (used.has(`zone${n}`)) n += 1;
  return `zone${n}`;
}

function applyRegionField(node: RegionNode, field: string, value: string): LayoutNode {
  if (field === "tag") {
    const tag = value.trim();
    return restamp(node, { tag: tag && tag !== "div" ? tag : undefined });
  }
  if (field === "id") return restamp(node, { id: value.trim() || undefined });
  if (field === "role") return restamp(node, { role: value.trim() || undefined });
  if (field === "className") return restamp(node, { className: value.trim() || undefined });
  if (field === "stayOpen") return restamp(node, { className: withToken(node.className, "w3-collapse", value === "true") });
  if (field === "columnWidth") return restamp(node, { className: setColumnWidth(node.className, value) });
  return node;
}

function applyZoneField(node: LayoutNode & { type: "zone" }, field: string, value: string): LayoutNode {
  if (field === "zoneId") {
    const id = value.trim();
    if (!id) return node;
    return { type: "zone", id, ...(node.className ? { className: node.className } : {}) };
  }
  if (field === "className") {
    const className = value.trim();
    return { type: "zone", id: node.id, ...(className ? { className } : {}) };
  }
  return node;
}

function applyStaticField(node: LayoutNode & { type: "static" }, field: string, value: string): LayoutNode {
  if (field === "html") return { type: "static", html: value };
  if (field === "paragraph") return { type: "static", html: `<p>${encodeText(value)}</p>` };
  return node;
}

function applyComponentField(node: LayoutComponentNode, field: string, value: string): LayoutNode {
  const props = { ...(node.props ?? {}) };
  if (field === "componentName") {
    const name = value.trim() || node.name;
    if (!SCOPED_MENUS.has(name)) delete props.scope;
    else if (typeof props.scope !== "string") props.scope = "sidebar";
    return componentWith(node, name, props);
  }
  if (field === "prop") return node;
  if (field.startsWith("prop:")) {
    const key = field.slice(5);
    const trimmed = value.trim();
    if (!trimmed) delete props[key];
    else props[key] = trimmed;
    return componentWith(node, node.name, props);
  }
  if (field === "extraProps") {
    let extra: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) extra = parsed as Record<string, unknown>;
    } catch {
      return node;
    }
    const kept: Record<string, unknown> = {};
    for (const key of KNOWN_PROPS) {
      if (key in props) kept[key] = props[key];
    }
    return componentWith(node, node.name, { ...extra, ...kept });
  }
  return node;
}

function componentWith(node: LayoutComponentNode, name: string, props: Record<string, unknown>): LayoutNode {
  const next: LayoutComponentNode = { type: "component", name };
  const cleaned = cleanProps(props);
  if (cleaned && Object.keys(cleaned).length) next.props = cleaned;
  if (node.children?.length) next.children = node.children;
  return next;
}

function restamp(node: RegionNode, patch: { tag?: string; id?: string; role?: string; className?: string }): RegionNode {
  const tag = "tag" in patch ? patch.tag : node.tag;
  const id = "id" in patch ? patch.id : node.id;
  const role = "role" in patch ? patch.role : node.role;
  const className = "className" in patch ? patch.className : node.className;
  const next: RegionNode = { type: "region", children: node.children };
  if (tag) next.tag = tag;
  if (id) next.id = id;
  if (role) next.role = role;
  if (className) next.className = className;
  return next;
}

function withToken(className: string | undefined, token: string, on: boolean): string | undefined {
  const tokens = classTokens(className).filter((item) => item !== token);
  if (on) tokens.push(token);
  return tokens.join(" ") || undefined;
}

function setColumnWidth(className: string | undefined, width: string): string {
  const tokens = classTokens(className).filter((token) => !/^m(?:4|5|6|7|8)$/.test(token));
  if (!tokens.includes("w3-col")) tokens.unshift("w3-col");
  tokens.push(width);
  return tokens.join(" ");
}

function withChildren(node: LayoutNode, children: LayoutNode[]): LayoutNode {
  if (node.type === "region") return { ...node, children };
  if (node.type === "component") return { ...node, children };
  return node;
}

function countKind(node: LayoutNode, kind: LayoutNode["type"]): number {
  let count = node.type === kind ? 1 : 0;
  for (const child of childList(node) ?? []) count += countKind(child, kind);
  return count;
}

function walk(node: LayoutNode, visit: (node: LayoutNode) => void): void {
  visit(node);
  for (const child of childList(node) ?? []) walk(child, visit);
}

function staticLabel(html: string): string {
  if (html.includes("myOverlay")) return "Overlay";
  if (html.includes("<img") || html.includes("wh-brand")) return "Custom HTML";
  if (html.includes("w3_open()")) return "Menu button";
  if (html.includes("w3_close()")) return "Close";
  if (html.includes("tessera-font-btn") || html.includes("body_switch")) return "Font buttons";
  const text = paragraphText(html);
  if (text) return text || "Text";
  return "Custom HTML";
}

function componentLabel(node: LayoutComponentNode): string {
  const shape = MENU_SHAPES.find((item) => item.name === node.name);
  const scope = typeof node.props?.scope === "string" ? node.props.scope : "";
  const place = scope === "topbar" ? "Top bar" : scope === "footer" ? "Footer" : scope === "sidebar" ? "Sidebar" : "";
  if (shape && place) return `Menu · ${shape.label} · ${place}`;
  if (shape) return shape.name === "pageNav" || shape.name === "navTags" ? shape.label : `Menu · ${shape.label}`;
  const choice = COMPONENT_CHOICES.find((item) => item.name === node.name);
  return choice?.label ?? node.name;
}

function cleanProps(props: Record<string, unknown>): Record<string, unknown> | undefined {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === "") continue;
    next[key] = value;
  }
  return Object.keys(next).length ? next : undefined;
}

function pathsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function pathStartsWith(path: number[], prefix: number[]): boolean {
  if (!prefix.length || path.length < prefix.length) return false;
  return prefix.every((value, index) => path[index] === value);
}

function adjustPath(path: number[], removed: number[]): number[] {
  const out = path.slice();
  const length = Math.min(path.length, removed.length);
  for (let i = 0; i < length; i++) {
    if (removed[i] === out[i]) continue;
    if (removed[i]! < out[i]!) out[i] = out[i]! - 1;
    break;
  }
  return out;
}

function encodeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function decodeText(value: string): string {
  return value.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
}
