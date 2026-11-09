import { focusFirstEditableField } from "./form-focus.js";
import { isTypingTarget } from "./typing-target.js";

/** Mod+E without Shift/Alt; not while typing in a field. */
export function isEditShortcut(event: KeyboardEvent): boolean {
  if (event.code !== "KeyE" || event.altKey || event.shiftKey) return false;
  if (!(event.metaKey || event.ctrlKey)) return false;
  if (event.defaultPrevented) return false;
  if (isTypingTarget(event.target)) return false;
  return true;
}

function focusFirstGridCell(root: ParentNode): boolean {
  const cell = root.querySelector<HTMLElement>("[data-grid-edit]");
  if (!cell || !isVisibleGridCell(cell)) return false;
  cell.focus();
  return true;
}

function isVisibleGridCell(el: HTMLElement): boolean {
  if (el.hidden) return false;
  if (
    el.isConnected &&
    "checkVisibility" in el &&
    typeof el.checkVisibility === "function" &&
    !el.checkVisibility()
  ) {
    return false;
  }
  return true;
}

/**
 * Enter dataset grid edit mode or focus the first editable field on the current page.
 */
export function triggerEditFocus(root: ParentNode): boolean {
  const gridEdit = root.querySelector<HTMLButtonElement>("[data-dataset-edit-mode]:not([disabled])");
  const inGridEdit = Boolean(root.querySelector("[data-dataset-save-grid]"));
  if (gridEdit && !inGridEdit) {
    gridEdit.click();
    requestAnimationFrame(() => {
      focusFirstGridCell(root);
    });
    return true;
  }
  if (inGridEdit && focusFirstGridCell(root)) return true;
  return focusFirstEditableField(root);
}
