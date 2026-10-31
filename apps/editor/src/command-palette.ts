import { activateDialog, type DialogController } from "./dialog.js";
import { escapeHtml } from "./dom.js";
import { loadEditorIndex, type EditorIndexItem } from "./editor-index-cache.js";
import { pickerItemsFromIndex, wirePickerList, type PickerItem } from "./entity-picker.js";

export type CommandPaletteHandlers = {
  onRender: () => void | Promise<void>;
  onPublish: () => void | Promise<void>;
};

let host: HTMLElement | null = null;
let dialog: DialogController | null = null;
let handlers: CommandPaletteHandlers | undefined;
let items: EditorIndexItem[] = [];

function paletteHtml(listId: string): string {
  return `<div class="editor-command-palette-backdrop" data-dialog-backdrop>
  <div class="editor-command-palette w3-card w3-white" role="dialog" aria-modal="true" aria-label="Go anywhere">
    <input type="search" class="editor-command-palette-search w3-input w3-border" placeholder="Go anywhere…" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="true" />
    <ul id="${escapeHtml(listId)}" class="editor-command-palette-list w3-ul" role="listbox"></ul>
  </div>
</div>`;
}

function selectItem(item: PickerItem): void {
  closeCommandPalette();
  if (item.action === "render") {
    void handlers?.onRender();
    return;
  }
  if (item.action === "publish") {
    void handlers?.onPublish();
    return;
  }
  if (item.hash && window.location.hash !== item.hash) {
    window.location.hash = item.hash;
  }
}

/** Mount the command palette shell once (handlers wired from app mount). */
export function mountCommandPalette(root: HTMLElement, paletteHandlers: CommandPaletteHandlers): void {
  host = root;
  handlers = paletteHandlers;
}

export function isCommandPaletteOpen(): boolean {
  return Boolean(dialog);
}

/** Open the global command palette. Returns false when the shell is not mounted. */
export async function openCommandPalette(): Promise<boolean> {
  if (!host) return false;
  if (dialog) {
    host.querySelector<HTMLInputElement>(".editor-command-palette-search")?.focus();
    return true;
  }

  const listId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `editor-command-palette-${crypto.randomUUID()}`
      : `editor-command-palette-${Math.random().toString(36).slice(2)}`;

  host.innerHTML = paletteHtml(listId);
  const dialogEl = host.querySelector<HTMLElement>('[role="dialog"]');
  const input = host.querySelector<HTMLInputElement>(".editor-command-palette-search");
  const list = host.querySelector<HTMLElement>(".editor-command-palette-list");
  if (!dialogEl || !input || !list) return false;

  try {
    items = await loadEditorIndex();
  } catch {
    host.innerHTML = "";
    return false;
  }

  const pickerItems = () => pickerItemsFromIndex(items);
  const picker = wirePickerList({
    input,
    list,
    listId,
    getItems: pickerItems,
    onSelect: selectItem,
    showCategory: true,
    onEscape: () => closeCommandPalette(),
  });
  picker.renderList();
  input.focus();

  dialog = activateDialog(host, {
    onCancel: () => closeCommandPalette(),
    initialFocus: ".editor-command-palette-search",
    closeOnBackdrop: true,
    returnFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
  });

  return true;
}

/** Close the command palette. Returns true when it was open. */
export function closeCommandPalette(): boolean {
  if (!dialog) return false;
  dialog.destroy();
  dialog = null;
  if (host) host.innerHTML = "";
  return true;
}
