import { hasOpenModal } from "./escape-key.js";
import { isTypingTarget } from "./typing-target.js";

export const LIST_ITEM_ACTIVE_CLASS = "editor-list-item-active";

function listMain(root: ParentNode): HTMLElement | null {
  if (root instanceof HTMLElement && root.classList.contains("editor-main")) return root;
  return root.querySelector<HTMLElement>(".editor-main");
}

/** True on record edit screens and other non-list main views. */
function listKeyboardBlocked(main: HTMLElement): boolean {
  if (main.querySelector("#record-form, #login-form, .editor-dataset-page, .editor-dataset-setup")) {
    return true;
  }
  return false;
}

export function navigableListRows(main: HTMLElement): HTMLElement[] {
  return [...main.querySelectorAll<HTMLElement>("li.editor-list-item, tr[data-list-href]")].filter(
    (row) => !row.hidden && row.getClientRects().length > 0,
  );
}

export function listRowHref(row: HTMLElement): string | undefined {
  const href = row.dataset.listHref?.trim();
  if (href) return href;
  const link = row.querySelector<HTMLAnchorElement>("a.editor-list-row[href], a[href]");
  const fromLink = link?.getAttribute("href")?.trim();
  return fromLink || undefined;
}

export function clearListKeyboardSelection(root: ParentNode): void {
  const main = listMain(root);
  if (!main) return;
  main.querySelectorAll(`.${LIST_ITEM_ACTIVE_CLASS}`).forEach((row) => {
    row.classList.remove(LIST_ITEM_ACTIVE_CLASS);
  });
}

function setListRowActive(main: HTMLElement, row: HTMLElement | null): void {
  clearListKeyboardSelection(main);
  if (!row) return;
  row.classList.add(LIST_ITEM_ACTIVE_CLASS);
  row.scrollIntoView({ block: "nearest" });
}

function activeListRow(main: HTMLElement): HTMLElement | null {
  const row = main.querySelector<HTMLElement>(`.${LIST_ITEM_ACTIVE_CLASS}`);
  if (!row || row.hidden || !row.getClientRects().length) {
    if (row) row.classList.remove(LIST_ITEM_ACTIVE_CLASS);
    return null;
  }
  return row;
}

function activateListRow(row: HTMLElement): void {
  const href = listRowHref(row);
  if (href) {
    window.location.hash = href.startsWith("#") ? href : `#${href}`;
    return;
  }
  const control = row.querySelector<HTMLElement>(
    "button.editor-list-row, button[data-edit-asset], [data-list-href]",
  );
  control?.click();
}

/**
 * Arrow keys move a list highlight; Enter / Space open the row. Nothing is selected until ↑ or ↓
 * (↑ lands on the last row, ↓ on the first). Returns true when the key was handled.
 */
export function handleListKeyboard(root: HTMLElement, event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  if (isTypingTarget(event.target)) return false;
  if (hasOpenModal()) return false;

  const main = listMain(root);
  if (!main || listKeyboardBlocked(main)) return false;

  const rows = navigableListRows(main);
  if (!rows.length) return false;

  const key = event.key;
  if (key !== "ArrowDown" && key !== "ArrowUp" && key !== "Enter" && key !== " ") return false;

  if (key === "Enter" || key === " ") {
    const current = activeListRow(main);
    if (!current) return false;
    event.preventDefault();
    activateListRow(current);
    return true;
  }

  const current = activeListRow(main);
  const index = current ? rows.indexOf(current) : -1;
  if (index >= 0 && index < rows.length && rows[index] !== current) {
    clearListKeyboardSelection(main);
  }

  event.preventDefault();
  if (key === "ArrowDown") {
    if (index < 0) setListRowActive(main, rows[0] ?? null);
    else if (index < rows.length - 1) setListRowActive(main, rows[index + 1] ?? null);
    return true;
  }

  if (index < 0) setListRowActive(main, rows[rows.length - 1] ?? null);
  else if (index > 0) setListRowActive(main, rows[index - 1] ?? null);
  else clearListKeyboardSelection(main);
  return true;
}
