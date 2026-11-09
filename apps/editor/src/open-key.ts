import { openEntityOpener } from "./entity-opener.js";

/** True for Cmd/Ctrl+Shift+O (open entity opener). */
export function isEntityOpenShortcut(event: KeyboardEvent): boolean {
  if (event.code !== "KeyO" || event.altKey || !event.shiftKey || event.defaultPrevented) return false;
  return event.metaKey || event.ctrlKey;
}

/**
 * Opens the entity opener on the current editor page. Returns true when an opener was opened or focused.
 */
export function triggerOpenAction(root: ParentNode): boolean {
  return openEntityOpener(root);
}
