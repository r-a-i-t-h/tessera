import { setDragGhost } from "../drag-ghost.js";
import { startDragScrollNavBuild, type DragScroll } from "../drag-scroll.js";
import type { NavBuildPaletteInfo } from "./palette.js";
import { pageTitleById, parsePaletteId } from "./palette.js";
import {
  getNode,
  insertNodes,
  nodeFromPalette,
  parsePath,
  pathKey,
  removeNode,
  relocate,
  paletteKindIsGroup,
  setGroupHeading,
  type NavBuildNode,
  type NavPaletteKind,
} from "./tree.js";
import { navBuildShell, navTreeHtml } from "./view.js";

type Drag =
  | { kind: "palette"; palette: NavPaletteKind }
  | { kind: "node"; path: number[] };

type State = {
  roots: NavBuildNode[];
  selected: number[];
  palette: NavBuildPaletteInfo;
  filterAbort?: AbortController;
};

const mounted = new WeakMap<HTMLFormElement, State>();

export function navBuildMarkup(info: NavBuildPaletteInfo): string {
  return navBuildShell(info);
}

export function mountNavBuild(
  form: HTMLFormElement,
  roots: NavBuildNode[],
  palette: NavBuildPaletteInfo,
  onEdit?: () => void,
): void {
  const prev = mounted.get(form);
  prev?.filterAbort?.abort();
  const state: State = {
    roots: structuredClone(roots),
    selected: [],
    palette,
  };
  mounted.set(form, state);
  paint(form, state);
  bind(form, state, onEdit);
  bindNavPaletteFilter(form, state);
}

export function readNavBuildRoot(form: HTMLFormElement): NavBuildNode[] | undefined {
  const state = mounted.get(form);
  return state ? structuredClone(state.roots) : undefined;
}

function bind(form: HTMLFormElement, state: State, onEdit?: () => void): void {
  let drag: Drag | undefined;
  let dragScroll: DragScroll | undefined;
  let onDocDragOver: ((event: DragEvent) => void) | undefined;

  const endDrag = () => {
    form.querySelectorAll(".is-over").forEach((el) => el.classList.remove("is-over"));
    form.classList.remove("editor-dragging");
    dragScroll?.stop();
    dragScroll = undefined;
    if (onDocDragOver) {
      document.removeEventListener("dragover", onDocDragOver);
      onDocDragOver = undefined;
    }
    drag = undefined;
  };

  form.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const paletteBtn = target.closest<HTMLElement>("[data-nav-palette]");
    if (paletteBtn?.dataset.navPalette) {
      event.preventDefault();
      const kind = parsePaletteId(paletteBtn.dataset.navPalette, state.palette);
      if (!kind) return;
      const dest = insertDestination(form, state, kind);
      addPalette(form, state, kind, dest.parent, dest.index);
      onEdit?.();
      return;
    }
    const remove = target.closest<HTMLElement>("[data-nav-remove]");
    if (remove?.dataset.path !== undefined) {
      event.preventDefault();
      const removed = removeNode(state.roots, parsePath(remove.dataset.path));
      if (!removed.ok) {
        showMessage(form, removed.error);
        return;
      }
      state.roots = removed.roots;
      if (!getNode(state.roots, state.selected)) state.selected = state.selected.slice(0, -1);
      showMessage(form, "");
      paint(form, state);
      onEdit?.();
      return;
    }
    const row = target.closest<HTMLElement>("[data-path]");
    if (
      row?.dataset.path !== undefined &&
      form.contains(row) &&
      !(target instanceof HTMLInputElement) &&
      !target.closest("[data-nav-heading]")
    ) {
      state.selected = parsePath(row.dataset.path);
      paint(form, state);
    }
  });

  form.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches("[data-nav-heading]")) return;
    const path = parsePath(target.dataset.path ?? "");
    state.roots = setGroupHeading(state.roots, path, target.value);
    form.dataset.dirty = "true";
    onEdit?.();
  });

  form.addEventListener("dragstart", (event) => {
    const target = event.target as HTMLElement;
    const palette = target.closest<HTMLElement>("[data-nav-palette]");
    const grip = target.closest<HTMLElement>("[data-drag-path]");
    let label = "";
    if (palette?.dataset.navPalette) {
      const kind = parsePaletteId(palette.dataset.navPalette, state.palette);
      if (!kind) {
        drag = undefined;
        return;
      }
      drag = { kind: "palette", palette: kind };
      label = palette.textContent ?? "";
    } else if (grip?.dataset.dragPath !== undefined) {
      drag = { kind: "node", path: parsePath(grip.dataset.dragPath) };
      label = grip.textContent ?? "";
    } else {
      drag = undefined;
      return;
    }
    event.dataTransfer?.setData("text/plain", "nav-build");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      setDragGhost(event.dataTransfer, label);
    }
    form.classList.add("editor-dragging");
    dragScroll?.stop();
    dragScroll = startDragScrollNavBuild(form);
    if (onDocDragOver) document.removeEventListener("dragover", onDocDragOver);
    onDocDragOver = (over) => {
      dragScroll?.update(over.clientY);
    };
    document.addEventListener("dragover", onDocDragOver);
  });

  form.addEventListener("dragend", () => {
    endDrag();
  });

  form.addEventListener("dragover", (event) => {
    dragScroll?.update(event.clientY);
    form.querySelectorAll(".is-over").forEach((el) => el.classList.remove("is-over"));
    const drop = (event.target as HTMLElement).closest<HTMLElement>("[data-drop-parent]");
    if (!drop || !drag) return;
    const parent = parsePath(drop.dataset.dropParent ?? "");
    if (!canDropGroup(form, state, drag, parent)) return;
    event.preventDefault();
    drop.classList.add("is-over");
  });

  form.addEventListener("dragleave", (event) => {
    const drop = (event.target as HTMLElement).closest<HTMLElement>("[data-drop-parent]");
    drop?.classList.remove("is-over");
  });

  form.addEventListener("drop", (event) => {
    const drop = (event.target as HTMLElement).closest<HTMLElement>("[data-drop-parent]");
    const active = drag;
    endDrag();
    if (!drop || !active || drop.dataset.dropParent === undefined) return;
    event.preventDefault();
    const parent = parsePath(drop.dataset.dropParent);
    const index = Number(drop.dataset.dropIndex ?? "0");
    if (!canDropGroup(form, state, active, parent)) {
      showMessage(form, "Groups stay at the top level while this option is on.");
      return;
    }
    if (active.kind === "palette") addPalette(form, state, active.palette, parent, index);
    else {
      state.roots = relocate(state.roots, active.path, parent, index);
      state.selected = parent.concat(index);
      showMessage(form, "");
      paint(form, state);
    }
    onEdit?.();
  });
}

function blockGroupNest(form: HTMLFormElement): boolean {
  const input = form.querySelector<HTMLInputElement>("[data-nav-build-block-group-nest]");
  return input?.checked !== false;
}

function dragIsGroup(drag: Drag, state: State): boolean {
  if (drag.kind === "palette") return paletteKindIsGroup(drag.palette);
  const node = getNode(state.roots, drag.path);
  return node?.kind === "group";
}

function canDropGroup(form: HTMLFormElement, state: State, drag: Drag, parent: number[]): boolean {
  if (!blockGroupNest(form)) return true;
  if (!dragIsGroup(drag, state)) return true;
  return parent.length === 0;
}

function insertDestination(
  form: HTMLFormElement,
  state: State,
  kind: NavPaletteKind,
): { parent: number[]; index: number } {
  if (blockGroupNest(form) && paletteKindIsGroup(kind)) {
    return { parent: [], index: state.roots.length };
  }
  return destination(state);
}

function addPalette(form: HTMLFormElement, state: State, kind: NavPaletteKind, parent: number[], index: number): void {
  const node = nodeFromPalette(kind);
  state.roots = insertNodes(state.roots, parent, index, [node]);
  state.selected = parent.concat(index);
  showMessage(form, "");
  paint(form, state);
}

function destination(state: State): { parent: number[]; index: number } {
  const node = getNode(state.roots, state.selected);
  if (node?.kind === "group") {
    return { parent: state.selected, index: node.children.length };
  }
  if (state.selected.length) {
    return { parent: state.selected.slice(0, -1), index: state.selected[state.selected.length - 1]! + 1 };
  }
  return { parent: [], index: state.roots.length };
}

function paint(form: HTMLFormElement, state: State): void {
  const tree = form.querySelector<HTMLElement>("[data-nav-build-tree]");
  if (tree) tree.innerHTML = navTreeHtml(state.roots, pathKey(state.selected), pageTitleById(state.palette));
}

function bindNavPaletteFilter(form: HTMLFormElement, state: State): void {
  const filter = form.querySelector<HTMLInputElement>("[data-nav-palette-filter='pages']");
  if (!filter) return;
  const abort = new AbortController();
  state.filterAbort = abort;
  const run = () => applyNavPalettePageFilter(form);
  filter.addEventListener("input", run, { signal: abort.signal });
  filter.addEventListener("search", run, { signal: abort.signal });
}

export function applyNavPalettePageFilter(form: ParentNode): void {
  const filter = form.querySelector<HTMLInputElement>("[data-nav-palette-filter='pages']");
  const list = form.querySelector("[data-nav-palette-pages]");
  if (!list) return;
  const needle = filter?.value.trim().toLowerCase() ?? "";
  list.querySelectorAll<HTMLElement>("[data-nav-palette-filter-text]").forEach((btn) => {
    const text = btn.dataset.navPaletteFilterText ?? btn.textContent?.trim().toLowerCase() ?? "";
    const hide = Boolean(needle) && !text.includes(needle);
    btn.hidden = hide;
    btn.classList.toggle("nav-build-palette-item-hidden", hide);
  });
}

function showMessage(form: HTMLFormElement, message: string): void {
  const el = form.querySelector<HTMLElement>("[data-nav-build-message]");
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
}
