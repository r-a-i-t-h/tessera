import { hasOpenModal } from "../escape-key.js";
import { LIST_ITEM_ACTIVE_CLASS, clearListKeyboardSelection } from "../list-keyboard.js";
import { isTypingTarget } from "../typing-target.js";

function editorMain(root: ParentNode): HTMLElement | null {
  if (root instanceof HTMLElement && root.classList.contains("editor-main")) return root;
  return root.querySelector<HTMLElement>(".editor-main");
}

function datasetGridPage(main: HTMLElement): HTMLElement | null {
  return main.querySelector<HTMLElement>(".editor-dataset-page");
}

/** View mode toolbar shows “Edit grid”; “Save grid” means inline editing and no row keyboard nav. */
function datasetGridViewMode(main: HTMLElement): boolean {
  return !main.querySelector("[data-dataset-save-grid]");
}

export function navigableDatasetGridRows(page: HTMLElement): HTMLElement[] {
  return [...page.querySelectorAll<HTMLElement>(".editor-dataset-grid tbody tr[data-record-row]")].filter(
    (row) => !row.hidden && row.getClientRects().length > 0,
  );
}

function setDatasetRowActive(page: HTMLElement, row: HTMLElement | null): void {
  const main = page.closest(".editor-main");
  if (main instanceof HTMLElement) clearListKeyboardSelection(main);
  if (!row) return;
  row.classList.add(LIST_ITEM_ACTIVE_CLASS);
  row.scrollIntoView({ block: "nearest" });
}

function activeDatasetGridRow(page: HTMLElement): HTMLElement | null {
  const row = page.querySelector<HTMLElement>(`.editor-dataset-grid tbody tr.${LIST_ITEM_ACTIVE_CLASS}`);
  if (!row || row.hidden || !row.getClientRects().length) {
    if (row) row.classList.remove(LIST_ITEM_ACTIVE_CLASS);
    return null;
  }
  return row;
}

function activateDatasetGridRow(row: HTMLElement): void {
  row.querySelector<HTMLElement>("[data-open-record]")?.click();
}

/**
 * Arrow keys move a row highlight on the dataset data grid (view mode); Enter / Space open the record
 * editor. Returns true when the key was handled.
 */
export function handleDatasetGridKeyboard(root: HTMLElement, event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  if (isTypingTarget(event.target)) return false;
  if (hasOpenModal()) return false;

  const main = editorMain(root);
  if (!main) return false;
  const page = datasetGridPage(main);
  if (!page || !datasetGridViewMode(main)) return false;

  const rows = navigableDatasetGridRows(page);
  if (!rows.length) return false;

  const key = event.key;
  if (key !== "ArrowDown" && key !== "ArrowUp" && key !== "Enter" && key !== " ") return false;

  if (key === "Enter" || key === " ") {
    const current = activeDatasetGridRow(page);
    if (!current) return false;
    event.preventDefault();
    activateDatasetGridRow(current);
    return true;
  }

  const current = activeDatasetGridRow(page);
  const index = current ? rows.indexOf(current) : -1;
  if (index >= 0 && index < rows.length && rows[index] !== current) {
    clearListKeyboardSelection(main);
  }

  event.preventDefault();
  if (key === "ArrowDown") {
    if (index < 0) setDatasetRowActive(page, rows[0] ?? null);
    else if (index < rows.length - 1) setDatasetRowActive(page, rows[index + 1] ?? null);
    return true;
  }

  if (index < 0) setDatasetRowActive(page, rows[rows.length - 1] ?? null);
  else if (index > 0) setDatasetRowActive(page, rows[index - 1] ?? null);
  else setDatasetRowActive(page, null);
  return true;
}
