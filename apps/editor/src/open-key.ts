import { openEntityOpener } from "./entity-opener.js";

/**
 * True for Cmd/Ctrl+O and Cmd/Ctrl+Shift+O.
 * Safari does not allow overriding Cmd+O (Open File); the Shift variant is used there.
 */
export function isEntityOpenShortcut(event: KeyboardEvent): boolean {
  if (event.code !== "KeyO" || event.altKey || event.defaultPrevented) return false;
  return event.metaKey || event.ctrlKey;
}

/**
 * Opens the entity opener on the current editor page. Returns true when an opener was opened or focused.
 */
export function triggerOpenAction(root: ParentNode): boolean {
  return openEntityOpener(root);
}
