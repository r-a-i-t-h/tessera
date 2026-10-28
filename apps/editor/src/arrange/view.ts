import type { LayoutNode } from "@r-a-i-t-h/tessera-model";
import { paletteToneIds, toneLabel } from "@r-a-i-t-h/tessera-sections";
import {
  W3_REGION_PRESETS,
  isKnownW3RegionPreset,
  w3RegionPresetClasses,
} from "@r-a-i-t-h/tessera-skin-w3";
import { codeWrapClass, codeWrapToggle } from "../code-wrap.js";
import { escapeHtml } from "../dom.js";
import { layoutStaticHtmlField } from "../raw-html-field.js";
import { REORDER_ICONS } from "../editor-icons.js";
import {
  COMPONENT_CHOICES,
  COMPONENT_UNSET,
  MENU_SHAPES,
  childList,
  classTokens,
  columnWidth,
  drawerState,
  extraProps,
  isUnsetComponent,
  nodeDetail,
  nodeLabel,
  paletteFor,
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

const REGION_ID_NOTE =
  "The list names this box from its id when set, otherwise from the skin preset below, otherwise “Region”.";
const ZONE_ID_NOTE = "The list names this box from its id.";
const SKIN_PRESET_HELP =
  'Adds default <a href="https://www.w3schools.com/w3css/w3css_intro.asp" target="_blank" rel="noopener noreferrer">W3.CSS</a> classes for this kind of region, merged with Classes below. Id names the box in the list when set; a preset is only a fallback name and does not set an HTML id.';

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
        <div class="editor-arrange-tree" data-arrange-tree></div>
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
    .map((group) =>
      group
        .map(
          (item) =>
            `<button type="button" class="w3-button w3-white w3-border" draggable="true" data-palette="${item.id}">${escapeHtml(item.label)}</button>`,
        )
        .join(""),
    )
    .join(`<hr class="editor-palette-rule">`);
  return `<p class="w3-small w3-text-grey">${hint}</p>${buttons}`;
}

export function treeHtml(root: LayoutNode, selected: string): string {
  return nodeHtml(root, [], selected);
}

function skinPresetOptions(current: string): string {
  const selected = current;
  const options = [`<option value=""${!selected ? " selected" : ""}>None</option>`];
  for (const preset of W3_REGION_PRESETS) {
    options.push(
      `<option value="${escapeHtml(preset.id)}"${preset.id === selected ? " selected" : ""}>${escapeHtml(preset.label)}</option>`,
    );
  }
  if (selected && !isKnownW3RegionPreset(selected)) {
    options.push(
      `<option value="${escapeHtml(selected)}" selected>Custom: ${escapeHtml(selected)}</option>`,
    );
  }
  return options.join("");
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
  const role = node.role?.trim() ?? "";
  const presetClasses = w3RegionPresetClasses(role);
  const adds =
    presetClasses ? `<p class="w3-small w3-text-grey">Adds: ${escapeHtml(presetClasses)}</p>` : "";
  return `<p><label>Tag <select class="w3-select w3-border" data-field="tag">${tags}</select></label></p>
    <p class="w3-small w3-text-grey">header, nav, main, and aside are plain blocks until a class places them. h1 is a heading.</p>
    <p><label>Id <input class="w3-input w3-border" data-field="id" value="${escapeHtml(node.id ?? "")}" /></label></p>
    <p class="w3-small w3-text-grey">${REGION_ID_NOTE}</p>
    ${node.id === "mySidebar" ? `<p class="w3-small w3-text-grey">The Menu button opens the element with this id.</p>` : ""}
    <p><label>Skin preset <select class="w3-select w3-border" data-field="role">${skinPresetOptions(role)}</select></label></p>
    <p class="w3-small w3-text-grey">${SKIN_PRESET_HELP}</p>
    ${adds}
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
    <p class="w3-small w3-text-grey">${ZONE_ID_NOTE}</p>
    <p class="w3-small w3-text-grey">${escapeHtml(who)}</p>
    <p><label>Classes <input class="w3-input w3-border" data-field="className" value="${escapeHtml(node.className ?? "")}" /></label></p>
    <p class="w3-small w3-text-grey">Set when this zone should be wrapped in a div. Empty leaves the page HTML bare.</p>`;
}

function staticFields(html: string): string {
  return `${layoutStaticHtmlField(html)}
    <p class="w3-small w3-text-grey">${ZONE_ID_NOTE}</p>
    <p class="w3-small w3-text-grey">This fragment is the same on every page.</p>`;
}

function componentFields(node: Extract<LayoutNode, { type: "component" }>, used: Set<string>): string {
  const unset = isUnsetComponent(node.name);
  const knownNames = new Set<string>(COMPONENT_CHOICES.map((item) => item.name));
  const extras = [...used, node.name].filter((name) => name && !isUnsetComponent(name) && !knownNames.has(name));
  const names = [...COMPONENT_CHOICES.map((item) => item.name), ...new Set(extras)];
  const choose = `<option value="${COMPONENT_UNSET}"${unset ? " selected" : ""}>Choose…</option>`;
  const options =
    choose +
    names
      .map((name) => {
        const choice = COMPONENT_CHOICES.find((item) => item.name === name);
        const label = choice?.label ?? name;
        return `<option value="${escapeHtml(name)}"${!unset && name === node.name ? " selected" : ""}>${escapeHtml(label)}</option>`;
      })
      .join("");
  const props = node.props ?? {};
  const scope = typeof props.scope === "string" ? props.scope : "sidebar";
  const scoped = node.name === "navFlat" || node.name === "navTree" || node.name === "navCollapse";
  const place =
    !unset && scoped
      ? `<p><label>Place <select class="w3-select w3-border" data-field="prop:scope">
        ${["sidebar", "topbar", "footer"].map((value) => `<option value="${value}"${value === scope ? " selected" : ""}>${value === "sidebar" ? "Sidebar" : value === "topbar" ? "Top bar" : "Footer"}</option>`).join("")}
      </select></label></p>
      <p class="w3-small w3-text-grey">Links come from <a href="#/navigation">Nav</a>. A row shows here only when that place is ticked.</p>`
      : "";
  const pickerLabel = MENU_SHAPES.some((item) => item.name === node.name) ? "List" : "Component";
  const shape = `<p><label>${pickerLabel} <select class="w3-select w3-border" data-field="componentName">${options}</select></label></p>
    ${unset ? `<p class="w3-small w3-text-grey">Pick a type. The same list is used on frame and page layouts.</p>` : ""}`;
  const known = unset ? "" : knownFields(node.name, props);
  const extra = unset ? {} : extraProps(props);
  const extraText = Object.keys(extra).length ? yamlish(extra) : "";
  const other = unset
    ? ""
    : `<p><span class="editor-code-head"><label for="arrange-extra-props">Other props</label>${codeWrapToggle("arrange-extra-props")}</span>
    <textarea id="arrange-extra-props" class="w3-input w3-border editor-yaml${codeWrapClass()}" data-field="extraProps" rows="4" spellcheck="false">${escapeHtml(extraText)}</textarea></p>`;
  return `${shape}${place}${known}${other}`;
}

function knownFields(name: string, props: Record<string, unknown>): string {
  const value = (key: string) => (typeof props[key] === "string" ? String(props[key]) : "");
  if (name === "navTags") {
    return `<p><label>Tag <input class="w3-input w3-border" data-field="prop:tag" value="${escapeHtml(value("tag"))}" /></label></p>
      <p class="w3-small w3-text-grey">Leave empty to group every tag. This list ignores the Nav record.</p>`;
  }
  if (name === "subpageList") {
    const tone = value("tone") || "plain";
    return `<p><label>Title <input class="w3-input w3-border" data-field="prop:title" value="${escapeHtml(value("title"))}" /></label></p>
      <p><label>Tone <select class="w3-select w3-border" data-field="prop:tone">
        ${paletteToneIds().map((item) => `<option value="${item}"${item === tone ? " selected" : ""}>${escapeHtml(toneLabel(item))}</option>`).join("")}
      </select></label></p>`;
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
  if (name === "searchBox") {
    return `<p><label>Placeholder <input class="w3-input w3-border" data-field="prop:placeholder" value="${escapeHtml(value("placeholder"))}" /></label></p>
      <p><label>Results page <input class="w3-input w3-border" data-field="prop:resultsPageId" value="${escapeHtml(value("resultsPageId"))}" placeholder="search" /></label></p>
      <p class="w3-small w3-text-grey">Empty results page uses <code>search</code>. Put this on the master layout; Enter opens that page.</p>`;
  }
  if (name === "searchResults") {
    return `<p><label>Results page <input class="w3-input w3-border" data-field="prop:resultsPageId" value="${escapeHtml(value("resultsPageId"))}" /></label></p>
      <p class="w3-small w3-text-grey">Empty uses this page’s id. Usual place is the Search page layout.</p>`;
  }
  return "";
}

function widthOptions(current: string): string {
  const rows = WIDTHS.some((item) => item[0] === current) ? WIDTHS : [...WIDTHS, [current, current] as [string, string]];
  return rows
    .map(([value, label]) => `<option value="${escapeHtml(value)}"${value === current ? " selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function nodeHtml(
  node: LayoutNode,
  path: number[],
  selected: string,
  siblingIndex = 0,
  siblingCount = 1,
): string {
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
  const buttons = path.length === 0 ? "" : reorderActions(key, siblingIndex, siblingCount);
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
    .map(
      (kid, index) =>
        `${gap(parent, index)}${nodeHtml(kid, [...parent, index], selected, index, kids.length)}`,
    )
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

function reorderActions(key: string, index: number, count: number): string {
  const path = ` data-path="${escapeHtml(key)}"`;
  const up = index <= 0 ? " disabled" : "";
  const down = index >= count - 1 ? " disabled" : "";
  return `<span class="editor-section-actions">${reorderIconButton("Up", REORDER_ICONS.up, `data-move="up"${up}${path}`)}${reorderIconButton("Down", REORDER_ICONS.down, `data-move="down"${down}${path}`)}${reorderIconButton("Remove", REORDER_ICONS.remove, `data-remove${path}`)}</span>`;
}

function reorderIconButton(label: string, icon: string, attributes: string): string {
  return `<button type="button" class="editor-section-icon" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${attributes}>${icon}</button>`;
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

function yamlish(value: Record<string, unknown>): string {
  return Object.entries(value)
    .map(([key, item]) => `${key}: ${typeof item === "string" ? item : JSON.stringify(item)}`)
    .join("\n");
}
