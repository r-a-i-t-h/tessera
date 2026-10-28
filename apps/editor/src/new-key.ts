/** Cmd/Ctrl+N targets: primary “New …” actions in the editor chrome. */
const NEW_ACTION_SELECTOR = "[data-action^='new-'], [data-dataset-add]";

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
 * Clicks the first available “New …” control in the app shell. Returns true when an action was triggered.
 */
export function triggerNewAction(root: ParentNode): boolean {
  for (const el of root.querySelectorAll<HTMLElement>(NEW_ACTION_SELECTOR)) {
    if (!(el instanceof HTMLButtonElement) || el.disabled || !isVisibleControl(el)) continue;
    el.click();
    return true;
  }
  return false;
}
