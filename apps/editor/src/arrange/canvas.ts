import type { LayoutNode } from "@r-a-i-t-h/tessera-model";
import { parse as parseYaml } from "yaml";
import {
  acceptsChildren,
  applyField,
  childList,
  cleanNode,
  componentNames,
  getNode,
  insertNodes,
  isFrame,
  moveSibling,
  nodesFor,
  parsePath,
  pathKey,
  relocate,
  removeNode,
  scopeForParent,
  setExtraProps,
  updateNode,
  type PaletteId,
} from "./tree.js";
import { setDragGhost } from "../drag-ghost.js";
import { arrangeShell, inspectorHtml, paletteHtml, treeHtml, type ArrangeInfo } from "./view.js";

type Drag =
  | { kind: "palette"; id: PaletteId }
  | { kind: "node"; path: number[] };

type State = {
  root: LayoutNode;
  selected: number[];
  info: ArrangeInfo;
  frame: boolean;
};

const mounted = new WeakMap<HTMLFormElement, State>();

export function arrangeMarkup(root: LayoutNode, info: ArrangeInfo): string {
  return arrangeShell(info, isFrame(root));
}

export function mountArrange(
  form: HTMLFormElement,
  root: LayoutNode,
  info: ArrangeInfo,
  onEdit?: (burstId?: string) => void,
): void {
  const state: State = {
    root: structuredClone(root),
    selected: [],
    info,
    frame: isFrame(root),
  };
  mounted.set(form, state);
  paint(form, state, true, false);
  bind(form, state, onEdit);
}

export function readArrangeRoot(form: HTMLFormElement): LayoutNode | undefined {
  const state = mounted.get(form);
  return state ? cleanNode(state.root) : undefined;
}

function bind(form: HTMLFormElement, state: State, onEdit?: (burstId?: string) => void): void {
  let drag: Drag | undefined;

  form.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const palette = target.closest<HTMLElement>("[data-palette]");
    if (palette?.dataset.palette) {
      event.preventDefault();
      addPalette(form, state, palette.dataset.palette as PaletteId, destination(state).parent, destination(state).index);
      onEdit?.();
      return;
    }
    const remove = target.closest<HTMLElement>("[data-remove]");
    if (remove?.dataset.path !== undefined) {
      event.preventDefault();
      const removed = removeNode(state.root, parsePath(remove.dataset.path));
      if (!removed.ok) {
        showMessage(form, removed.error);
        return;
      }
      state.root = removed.root;
      if (!getNode(state.root, state.selected)) state.selected = state.selected.slice(0, -1);
      showMessage(form, "");
      paint(form, state, true, true);
      onEdit?.();
      return;
    }
    const move = target.closest<HTMLElement>("[data-move]");
    if (move?.dataset.path !== undefined && (move.dataset.move === "up" || move.dataset.move === "down")) {
      event.preventDefault();
      const path = parsePath(move.dataset.path);
      const dir = move.dataset.move === "up" ? -1 : 1;
      state.root = moveSibling(state.root, path, dir);
      const landed = path.slice();
      const index = landed[landed.length - 1];
      if (index !== undefined) landed[landed.length - 1] = index + dir;
      state.selected = getNode(state.root, landed) ? landed : path;
      showMessage(form, "");
      paint(form, state, true, true);
      onEdit?.();
      return;
    }
    const node = target.closest<HTMLElement>(".arrange-node");
    if (node?.dataset.path !== undefined && form.contains(node)) {
      state.selected = parsePath(node.dataset.path);
      paint(form, state, true, false);
    }
  });

  form.addEventListener("input", (event) => {
    const field = fieldOf(event.target);
    if (!field || field === "extraProps") return;
    writeField(form, state, field, controlValue(event.target));
    paint(form, state, false, true);
    if (isTypingControl(event.target)) onEdit?.(`${pathKey(state.selected)}:${field}`);
  });

  form.addEventListener("change", (event) => {
    const field = fieldOf(event.target);
    if (!field) return;
    if (field === "extraProps") {
      const wrote = writeExtra(form, state, controlValue(event.target));
      paint(form, state, true, true);
      if (wrote) onEdit?.(`${pathKey(state.selected)}:extraProps`);
      return;
    }
    writeField(form, state, field, controlValue(event.target));
    const rebuild = field === "componentName" || field === "className" || field === "tag" || field === "stayOpen" || field === "columnWidth";
    paint(form, state, rebuild, true);
    if (isTypingControl(event.target)) onEdit?.(`${pathKey(state.selected)}:${field}`);
    else onEdit?.();
  });

  form.addEventListener("dragstart", (event) => {
    const target = event.target as HTMLElement;
    const palette = target.closest<HTMLElement>("[data-palette]");
    const grip = target.closest<HTMLElement>("[data-drag-path]");
    let label = "";
    if (palette?.dataset.palette) {
      drag = { kind: "palette", id: palette.dataset.palette as PaletteId };
      label = palette.textContent ?? "";
    } else if (grip?.dataset.dragPath !== undefined) {
      drag = { kind: "node", path: parsePath(grip.dataset.dragPath) };
      label = grip.textContent ?? "";
    } else {
      drag = undefined;
      return;
    }
    event.dataTransfer?.setData("text/plain", "arrange");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      setDragGhost(event.dataTransfer, label);
    }
  });

  form.addEventListener("dragover", (event) => {
    const drop = (event.target as HTMLElement).closest<HTMLElement>("[data-drop-parent]");
    if (!drop || !drag) return;
    event.preventDefault();
    drop.classList.add("is-over");
  });

  form.addEventListener("dragleave", (event) => {
    const drop = (event.target as HTMLElement).closest<HTMLElement>("[data-drop-parent]");
    drop?.classList.remove("is-over");
  });

  form.addEventListener("drop", (event) => {
    const drop = (event.target as HTMLElement).closest<HTMLElement>("[data-drop-parent]");
    form.querySelectorAll(".is-over").forEach((el) => el.classList.remove("is-over"));
    if (!drop || !drag || drop.dataset.dropParent === undefined) return;
    event.preventDefault();
    const parent = parsePath(drop.dataset.dropParent);
    const index = Number(drop.dataset.dropIndex ?? "0");
    if (drag.kind === "palette") addPalette(form, state, drag.id, parent, index);
    else {
      state.root = relocate(state.root, drag.path, parent, index);
      state.selected = parent;
      showMessage(form, "");
      paint(form, state, true, true);
    }
    onEdit?.();
    drag = undefined;
  });
}

function addPalette(form: HTMLFormElement, state: State, id: PaletteId, parent: number[], index: number): void {
  const made = nodesFor(id, state.root);
  if (!made.ok) {
    showMessage(form, made.error);
    return;
  }
  const place = scopeForParent(parent.length === 0 ? state.root : getNode(state.root, parent));
  const nodes = made.nodes.map((node) => {
    if (!place || node.type !== "component") return node;
    if (node.name !== "navFlat" && node.name !== "navTree" && node.name !== "navCollapse") return node;
    return applyField(node, "prop:scope", place);
  });
  state.root = insertNodes(state.root, parent, index, nodes);
  state.selected = parent.concat(index);
  showMessage(form, "");
  paint(form, state, true, true);
}

function destination(state: State): { parent: number[]; index: number } {
  const node = getNode(state.root, state.selected);
  if (node && acceptsChildren(node)) {
    return { parent: state.selected, index: (childList(node) ?? []).length };
  }
  if (state.selected.length) {
    return { parent: state.selected.slice(0, -1), index: state.selected[state.selected.length - 1]! + 1 };
  }
  return { parent: [], index: (childList(state.root) ?? []).length };
}

function writeField(form: HTMLFormElement, state: State, field: string, value: string): void {
  const node = getNode(state.root, state.selected);
  if (!node) return;
  state.root = updateNode(state.root, state.selected, applyField(node, field, value));
  showMessage(form, "");
}

function writeExtra(form: HTMLFormElement, state: State, value: string): boolean {
  const node = getNode(state.root, state.selected);
  if (!node) return false;
  let parsed: unknown = {};
  if (value.trim()) {
    try {
      parsed = parseYaml(value);
    } catch {
      showMessage(form, "Other props are not valid YAML.");
      return false;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    showMessage(form, "Other props should be a YAML mapping.");
    return false;
  }
  state.root = updateNode(state.root, state.selected, setExtraProps(node, parsed as Record<string, unknown>));
  showMessage(form, "");
  return true;
}

function paint(form: HTMLFormElement, state: State, inspector: boolean, dirty: boolean): void {
  const frame = isFrame(state.root);
  if (frame !== state.frame) {
    state.frame = frame;
    const palette = form.querySelector("[data-arrange-palette]");
    if (palette) palette.innerHTML = paletteHtml(frame);
  }
  const tree = form.querySelector("[data-arrange-tree]");
  if (tree) tree.innerHTML = treeHtml(state.root, pathKey(state.selected));
  if (inspector) {
    const active = document.activeElement;
    const field = active instanceof HTMLElement ? active.dataset.field : undefined;
    const pos =
      active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active.selectionStart : null;
    const aside = form.querySelector("[data-arrange-inspector]");
    if (aside) aside.innerHTML = inspectorHtml(getNode(state.root, state.selected), state.info, frame, componentNames(state.root));
    if (field) {
      const next = form.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`);
      next?.focus();
      if (pos != null && (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement)) {
        next.setSelectionRange(pos, pos);
      }
    }
  }
  if (dirty) form.dataset.dirty = "true";
}

function showMessage(form: HTMLFormElement, text: string): void {
  const el = form.querySelector<HTMLElement>("[data-arrange-message]");
  if (!el) return;
  el.textContent = text;
  el.hidden = text.length === 0;
}

function fieldOf(target: EventTarget | null): string | undefined {
  if (!(target instanceof HTMLElement)) return undefined;
  return target.dataset.field;
}

function isTypingControl(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement && target.type !== "checkbox" && target.type !== "radio")
  );
}

function controlValue(target: EventTarget | null): string {
  if (target instanceof HTMLInputElement && target.type === "checkbox") return target.checked ? "true" : "false";
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return target.value;
  }
  return "";
}
