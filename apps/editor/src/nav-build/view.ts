import { escapeHtml } from "../dom.js";
import { REORDER_ICONS } from "../editor-icons.js";
import { fieldId } from "../dom.js";
import type { NavBuildGroup, NavBuildNode } from "./tree.js";
import { childList, groupHeadingPlaceholder, nodeLabel, pathKey } from "./tree.js";
import type { NavBuildPaletteInfo } from "./palette.js";
import { navPaletteHtml } from "./palette.js";

export function navBuildShell(info: NavBuildPaletteInfo): string {
  return `<div class="editor-nav-build">
    <p class="nav-build-options editor-check">
      <label><input type="checkbox" data-nav-build-block-group-nest checked /> Keep groups at top level</label>
    </p>
    <p class="w3-panel w3-pale-red" data-nav-build-message role="alert" hidden></p>
    <div class="editor-nav-build-layout">
      <div class="editor-nav-build-stage editor-nav-build-scroll">
        <div class="editor-nav-build-tree" data-nav-build-tree></div>
      </div>
      <div class="editor-nav-build-palette-panel editor-nav-build-scroll">
        <div class="editor-palette editor-nav-build-palette" data-nav-build-palette>${navPaletteHtml(info)}</div>
      </div>
    </div>
  </div>`;
}

export function navTreeHtml(
  roots: readonly NavBuildNode[],
  selected: string,
  pageTitles?: ReadonlyMap<string, string>,
): string {
  if (!roots.length) {
    return `<p class="nav-build-empty">No menu entries yet. Drag from the palette.</p>${rootListHtml([], selected, pageTitles)}`;
  }
  return rootListHtml(roots, selected, pageTitles);
}

function rootListHtml(kids: readonly NavBuildNode[], selected: string, pageTitles?: ReadonlyMap<string, string>): string {
  const inner = kids
    .map((kid, index) => `${gap([], index)}${nodeHtml(kid, [index], selected, pageTitles)}`)
    .join("");
  const hint = kids.length === 0 ? "Drop here" : "";
  const well = hint
    ? `<p class="nav-build-well" data-drop-parent="" data-drop-index="${kids.length}">${hint}</p>`
    : "";
  return `<div class="nav-build-children" data-drop-parent="" data-drop-index="${kids.length}">${inner}${gap([], kids.length)}${well}</div>`;
}

function nodeHtml(
  node: NavBuildNode,
  path: number[],
  selected: string,
  pageTitles?: ReadonlyMap<string, string>,
): string {
  const key = pathKey(path);
  const kids = childList(node);
  const buttons = reorderActions(key);
  const label = nodeLabel(node, pageTitles);
  const body = kids
    ? childrenHtml(kids, path, selected, pageTitles)
    : `<div class="nav-build-leaf">${escapeHtml(label)}</div>`;
  const kind = node.kind === "group" ? "group" : "link";
  const bar =
    node.kind === "group"
      ? groupBarHtml(node, key, buttons)
      : `<div class="nav-build-bar">
      <span class="nav-build-grip" draggable="true" data-drag-path="${escapeHtml(key)}">${escapeHtml(label)}</span>
      ${buttons}
    </div>`;
  return `<div class="nav-build-node${key === selected ? " is-selected" : ""}" data-path="${escapeHtml(key)}" data-kind="${kind}">
    ${bar}
    ${node.kind === "group" ? body : ""}
  </div>`;
}

function groupBarHtml(node: NavBuildGroup, key: string, buttons: string): string {
  const inputId = fieldId(`nav-build-heading-${key}`);
  const placeholder = groupHeadingPlaceholder(node);
  return `<div class="nav-build-bar nav-build-bar-group">
    <span class="nav-build-grip nav-build-grip-handle" draggable="true" data-drag-path="${escapeHtml(key)}" aria-hidden="true" title="Drag">≡</span>
    <input id="${inputId}" class="w3-input nav-build-heading-input" data-nav-heading data-path="${escapeHtml(key)}" type="text" aria-label="Group heading" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(node.heading)}" />
    ${buttons}
  </div>`;
}

function childrenHtml(
  kids: readonly NavBuildNode[],
  parent: number[],
  selected: string,
  pageTitles?: ReadonlyMap<string, string>,
): string {
  const parentKey = escapeHtml(pathKey(parent));
  const inner = kids
    .map(
      (kid, index) =>
        `${gap(parent, index)}${nodeHtml(kid, [...parent, index], selected, pageTitles)}`,
    )
    .join("");
  const hint = kids.length === 0 ? "Drop inside this group" : "";
  const well = hint
    ? `<p class="nav-build-well" data-drop-parent="${parentKey}" data-drop-index="${kids.length}">${hint}</p>`
    : "";
  return `<div class="nav-build-children" data-drop-parent="${parentKey}" data-drop-index="${kids.length}">${inner}${gap(parent, kids.length)}${well}</div>`;
}

function gap(parent: number[], index: number): string {
  return `<div class="nav-build-gap" data-drop-parent="${escapeHtml(pathKey(parent))}" data-drop-index="${index}"></div>`;
}

function reorderActions(key: string): string {
  const path = ` data-path="${escapeHtml(key)}"`;
  return `<span class="editor-section-actions">${reorderIconButton("Remove", REORDER_ICONS.remove, `data-nav-remove${path}`)}</span>`;
}

function reorderIconButton(label: string, icon: string, attributes: string): string {
  return `<button type="button" class="editor-section-icon" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" ${attributes}>${icon}</button>`;
}
