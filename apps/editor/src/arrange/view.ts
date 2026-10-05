import type { LayoutNode } from "@r-a-i-t-h/tessera-model";
import {
  COMPONENT_CHOICES,
  MENU_SHAPES,
  childList,
  classTokens,
  columnWidth,
  drawerState,
  extraProps,
  nodeDetail,
  nodeLabel,
  paletteFor,
  paragraphText,
  pathKey,
  stayOpenNote,
  tagOptions,
} from "./tree.js";

export type ArrangeInfo = {
  layoutId: string;
  master: boolean;
  fallback: boolean;
  typeIds: string[];
};

const WIDTHS: [string, string][] = [
  ["m6", "Half"],
  ["m8", "Two thirds"],
  ["m7", "Wider"],
  ["m5", "Narrower"],
  ["m4", "One third"],
];

export function arrangeShell(info: ArrangeInfo, frame: boolean): string {
  return `<div class="editor-arrange">
    ${banner(info, frame)}
    <p class="w3-panel w3-pale-red" data-arrange-message role="alert" hidden></p>
    <div class="editor-arrange-layout">
      <div class="editor-palette" data-arrange-palette>${paletteHtml(frame)}</div>
      <div class="editor-arrange-stage">
        <p class="editor-arrange-width">
          <button type="button" class="w3-button w3-small w3-white" data-width="narrow">Narrow</button>
          <button type="button" class="w3-button w3-small w3-theme" data-width="wide">Wide</button>
        </p>
        <p class="w3-text-grey" data-arrange-closed hidden>The side menu stays closed on a wide window until Stay open is ticked.</p>
        <div class="editor-arrange-tree" data-arrange-tree data-width="wide"></div>
      </div>
      <aside class="editor-arrange-inspector" data-arrange-inspector></aside>
    </div>
  </div>`;
}

export function paletteHtml(frame: boolean): string {
  const hint = frame
    ? "Drag onto a box, or click to add. A class here is shared by every page."
    : "Drag onto a region, or click to add. Zones become Compose canvases. A class here is shared by every page of this layout.";
  const buttons = paletteFor(frame)
    .map(
      (item) =>
        `<button type="button" class="w3-button w3-white w3-border" draggable="true" data-palette="${item.id}">${escapeHtml(item.label)}</button>`,
    )
    .join("");
  return `<p class="w3-small w3-text-grey">${hint}</p>${buttons}`;
}

export function treeHtml(root: LayoutNode, selected: string): string {
  return nodeHtml(root, [], selected);
}

export function closedDrawer(root: LayoutNode): boolean {
  return walkSome(root, (node) => drawerState(node) === "closed");
}

export function inspectorHtml(node: LayoutNode | undefined, info: ArrangeInfo, frame: boolean, names = new Set<string>()): string {
  if (!node) return `<p class="w3-text-grey">Select a box.</p>`;
  const parts = [`<h2 class="w3-medium">${escapeHtml(nodeLabel(node))}</h2>`];
  if (node.type === "region") parts.push(regionFields(node));
  if (node.type === "zone") parts.push(zoneFields(node, info, frame));
  if (node.type === "page") {
    parts.push(`<p>Each page’s layout is drawn here. The page editor fills zones on that layout, not this slot.</p>`);
  }
  if (node.type === "static") parts.push(staticFields(node.html));
  if (node.type === "component") parts.push(componentFields(node, names));
  return parts.join("");
}

function regionFields(node: Extract<LayoutNode, { type: "region" }>): string {
  const tags = tagOptions(node.tag)
    .map((tag) => `<option value="${escapeHtml(tag)}"${tag === (node.tag ?? "div") ? " selected" : ""}>${escapeHtml(tag)}</option>`)
    .join("");
  const width = columnWidth(node.className);
  const widths = classTokens(node.className).includes("w3-col") ? widthOptions(width ?? "m6") : undefined;
  const drawer = drawerState(node);
  const note = stayOpenNote(node);
  return `<p><label>Tag <select class="w3-select w3-border" data-field="tag">${tags}</select></label></p>
    <p class="w3-small w3-text-grey">header, nav, main, and aside are plain blocks until a class places them. h1 is a heading.</p>
    <p><label>Id <input class="w3-input w3-border" data-field="id" value="${escapeHtml(node.id ?? "")}" /></label></p>
    ${node.id === "mySidebar" ? `<p class="w3-small w3-text-grey">The Menu button opens the element with this id.</p>` : ""}
    <p><label>Role <input class="w3-input w3-border" data-field="role" value="${escapeHtml(node.role ?? "")}" /></label></p>
    <p class="w3-small w3-text-grey">A role can add skin classes. Row adds w3-row.</p>
    <p><label>Classes <input class="w3-input w3-border" data-field="className" value="${escapeHtml(node.className ?? "")}" /></label></p>
    <p class="w3-small w3-text-grey">Shared by every page that uses this layout.</p>
    ${
      widths
        ? `<p><label>Column width <select class="w3-select w3-border" data-field="columnWidth">${widths}</select></label></p>`
        : ""
    }
    ${
      drawer
        ? `<p class="editor-check"><label><input type="checkbox" data-field="stayOpen"${drawer === "open" ? " checked" : ""} /> Stay open on a wide window</label></p>
           <p class="w3-small w3-text-grey">This writes w3-collapse: hidden below 993px, open above it.</p>
           ${note ? `<p class="w3-small w3-text-grey">${escapeHtml(note)}</p>` : ""}`
        : ""
    }`;
}

function zoneFields(node: Extract<LayoutNode, { type: "zone" }>, info: ArrangeInfo, frame: boolean): string {
  const who = frame
    ? "This zone is on the frame. Compose edits zones on the page layout, so it will not show a canvas for this one."
    : info.typeIds.length
      ? `${info.typeIds.join(", ")} pages fill this in Compose.`
      : "Pages that use this layout fill this in Compose.";
  return `<p><label>Name <input class="w3-input w3-border" data-field="zoneId" value="${escapeHtml(node.id)}" /></label></p>
    <p class="w3-small w3-text-grey">${escapeHtml(who)}</p>
    <p><label>Classes <input class="w3-input w3-border" data-field="className" value="${escapeHtml(node.className ?? "")}" /></label></p>
    <p class="w3-small w3-text-grey">Set when this zone should be wrapped in a div. Empty leaves the page HTML bare.</p>`;
}

function staticFields(html: string): string {
  const text = paragraphText(html);
  if (text !== undefined) {
    return `<p><label>Text <input class="w3-input w3-border" data-field="paragraph" value="${escapeHtml(text)}" /></label></p>
      <p class="w3-small w3-text-grey">Stored as a paragraph. The same text is on every page.</p>`;
  }
  return `<p><label>HTML <textarea class="w3-input w3-border editor-yaml" data-field="html" rows="8" spellcheck="false">${escapeHtml(html)}</textarea></label></p>
    <p class="w3-small w3-text-grey">This fragment is the same on every page.</p>`;
}

function componentFields(node: Extract<LayoutNode, { type: "component" }>, used: Set<string>): string {
  const names = new Set<string>(COMPONENT_CHOICES.map((item) => item.name));
  names.add(node.name);
  for (const name of used) names.add(name);
  const options = [...names]
    .map((name) => {
      const choice = COMPONENT_CHOICES.find((item) => item.name === name);
      const label = choice?.label ?? name;
      return `<option value="${escapeHtml(name)}"${name === node.name ? " selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
  const props = node.props ?? {};
  const scope = typeof props.scope === "string" ? props.scope : "sidebar";
  const scoped = node.name === "navFlat" || node.name === "navTree" || node.name === "navCollapse";
  const place = scoped
    ? `<p><label>Place <select class="w3-select w3-border" data-field="prop:scope">
        ${["sidebar", "topbar", "footer"].map((value) => `<option value="${value}"${value === scope ? " selected" : ""}>${value === "sidebar" ? "Sidebar" : value === "topbar" ? "Top bar" : "Footer"}</option>`).join("")}
      </select></label></p>
      <p class="w3-small w3-text-grey">Links come from <a href="#/records/nav">Nav</a>. A row shows here only when that place is ticked.</p>`
    : "";
  const shape = MENU_SHAPES.some((item) => item.name === node.name)
    ? `<p><label>List <select class="w3-select w3-border" data-field="componentName">${options}</select></label></p>`
    : `<p><label>Component <select class="w3-select w3-border" data-field="componentName">${options}</select></label></p>`;
  const known = knownFields(node.name, props);
  const extra = extraProps(props);
  const extraText = Object.keys(extra).length ? yamlish(extra) : "";
  return `${shape}${place}${known}
    <p><label>Other props <textarea class="w3-input w3-border editor-yaml" data-field="extraProps" rows="4" spellcheck="false">${escapeHtml(extraText)}</textarea></label></p>`;
}

function knownFields(name: string, props: Record<string, unknown>): string {
  const value = (key: string) => (typeof props[key] === "string" ? String(props[key]) : "");
  if (name === "navTags") {
    return `<p><label>Tag <input class="w3-input w3-border" data-field="prop:tag" value="${escapeHtml(value("tag"))}" /></label></p>
      <p class="w3-small w3-text-grey">Leave empty to group every tag. This list ignores the Nav record.</p>`;
  }
  if (name === "subpageList") {
    return `<p><label>Title <input class="w3-input w3-border" data-field="prop:title" value="${escapeHtml(value("title"))}" /></label></p>`;
  }
  if (name === "linkCluster") {
    const source = value("source") || "children";
    const variant = value("variant") || "list";
    return `<p><label>Source <select class="w3-select w3-border" data-field="prop:source">
        ${["children", "type", "nav"].map((item) => `<option value="${item}"${item === source ? " selected" : ""}>${item}</option>`).join("")}
      </select></label></p>
      <p><label>Variant <select class="w3-select w3-border" data-field="prop:variant">
        ${["list", "pills", "cards"].map((item) => `<option value="${item}"${item === variant ? " selected" : ""}>${item}</option>`).join("")}
      </select></label></p>
      <p><label>Type <input class="w3-input w3-border" data-field="prop:type" value="${escapeHtml(value("type"))}" /></label></p>
      <p><label>Heading <input class="w3-input w3-border" data-field="prop:heading" value="${escapeHtml(value("heading"))}" /></label></p>
      <p><label>Title <input class="w3-input w3-border" data-field="prop:title" value="${escapeHtml(value("title"))}" /></label></p>`;
  }
  return "";
}

function widthOptions(current: string): string {
  const rows = WIDTHS.some((item) => item[0] === current) ? WIDTHS : [...WIDTHS, [current, current] as [string, string]];
  return rows
    .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === current ? " selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function nodeHtml(node: LayoutNode, path: number[], selected: string): string {
  const key = pathKey(path);
  const kids = childList(node);
  const drawer = drawerState(node);
  const attrs = [
    `data-path="${escapeHtml(key)}"`,
    `data-kind="${node.type}"`,
    node.type === "region" && node.tag ? `data-tag="${escapeHtml(node.tag)}"` : "",
    node.type === "region" && node.role ? `data-role="${escapeHtml(node.role)}"` : "",
    drawer ? `data-drawer="${drawer}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const buttons =
    path.length === 0
      ? ""
      : `<button type="button" class="w3-button w3-tiny w3-white" data-move="up" data-path="${escapeHtml(key)}">Up</button>
         <button type="button" class="w3-button w3-tiny w3-white" data-move="down" data-path="${escapeHtml(key)}">Down</button>
         <button type="button" class="w3-button w3-tiny w3-white" data-remove data-path="${escapeHtml(key)}">Remove</button>`;
  const body = kids
    ? childrenHtml(kids, path, selected, node.type === "component")
    : `<div class="arrange-body">${escapeHtml(leafText(node))}</div>`;
  return `<div class="arrange-node${key === selected ? " is-selected" : ""}" ${attrs}>
    <div class="arrange-bar">
      <span class="arrange-grip" draggable="true" data-drag-path="${escapeHtml(key)}">${escapeHtml(nodeLabel(node))}</span>
      ${buttons}
    </div>
    ${body}
  </div>`;
}

function childrenHtml(kids: LayoutNode[], parent: number[], selected: string, component: boolean): string {
  const parentKey = escapeHtml(pathKey(parent));
  const inner = kids
    .map((kid, index) => `${gap(parent, index)}${nodeHtml(kid, [...parent, index], selected)}`)
    .join("");
  const hint = kids.length === 0 ? (component ? "Drop inside this component" : "Drop a piece here") : "";
  const well = hint
    ? `<p class="arrange-well" data-drop-parent="${parentKey}" data-drop-index="${kids.length}">${hint}</p>`
    : "";
  return `<div class="arrange-children" data-drop-parent="${parentKey}" data-drop-index="${kids.length}">${inner}${gap(parent, kids.length)}${well}</div>`;
}

function gap(parent: number[], index: number): string {
  return `<div class="arrange-gap" data-drop-parent="${escapeHtml(pathKey(parent))}" data-drop-index="${index}"></div>`;
}

function leafText(node: LayoutNode): string {
  if (node.type === "page") return "Each page is drawn here.";
  return nodeDetail(node);
}

function banner(info: ArrangeInfo, frame: boolean): string {
  const use = info.master
    ? "This is the frame around every page."
    : info.fallback
      ? "This is the site’s default page layout."
      : info.typeIds.length
        ? `Used by ${info.typeIds.join(", ")}.`
        : frame
          ? "This frame has a page slot."
          : "Page layout.";
  const rest = frame
    ? " Each page is drawn in the page slot. Menus read the Nav record. Widths and colours of the default chrome are on Styles."
    : " Zones you add here are what Compose fills. A class on a region is shared by every page that uses this layout.";
  return `<p class="w3-text-grey">${escapeHtml(use)}${escapeHtml(rest)} <a href="#/guide">Guide</a>.</p>`;
}

function walkSome(node: LayoutNode, pred: (node: LayoutNode) => boolean): boolean {
  if (pred(node)) return true;
  for (const child of childList(node) ?? []) {
    if (walkSome(child, pred)) return true;
  }
  return false;
}

function yamlish(value: Record<string, unknown>): string {
  return Object.entries(value)
    .map(([key, item]) => `${key}: ${typeof item === "string" ? item : JSON.stringify(item)}`)
    .join("\n");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
