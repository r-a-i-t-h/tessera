import { isTypingTarget } from "./typing-target.js";

/** Mod+A without Shift/Alt; not while typing in a field. */
export function isAddShortcut(event: KeyboardEvent): boolean {
  if (event.code !== "KeyA" || event.altKey || event.shiftKey) return false;
  if (!(event.metaKey || event.ctrlKey)) return false;
  if (event.defaultPrevented) return false;
  if (isTypingTarget(event.target)) return false;
  return true;
}

/** Cmd/Ctrl+A targets: primary “Add …” actions in the editor chrome. */
const ADD_ACTION_SELECTOR = "[data-action^='add-'], [data-dataset-add]";

function isVisibleControl(el: HTMLElement): boolean {
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
 * Clicks the first available “Add …” control in the app shell. Returns true when an action was triggered.
 */
export function triggerAddAction(root: ParentNode): boolean {
  for (const el of root.querySelectorAll<HTMLElement>(ADD_ACTION_SELECTOR)) {
    if (!(el instanceof HTMLButtonElement) || el.disabled || !isVisibleControl(el)) continue;
    el.click();
    return true;
  }
  return false;
}
