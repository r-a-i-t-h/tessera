import { openCommandPalette, isCommandPaletteOpen } from "./command-palette.js";

/** True for Cmd/Ctrl+Shift+P. */
export function isCommandPaletteShortcut(event: KeyboardEvent): boolean {
  if (event.code !== "KeyP" || !event.shiftKey || event.altKey || event.defaultPrevented) return false;
  return event.metaKey || event.ctrlKey;
}

export async function triggerPaletteAction(): Promise<boolean> {
  if (isCommandPaletteOpen()) {
    return openCommandPalette();
  }
  return openCommandPalette();
}
