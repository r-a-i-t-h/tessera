import { showEditorToast } from "./dom.js";

/** Cmd/Ctrl+S without Shift/Alt. */
export function isEditorSaveShortcut(event: KeyboardEvent): boolean {
  if (event.code !== "KeyS" || event.altKey || event.shiftKey) return false;
  return event.metaKey || event.ctrlKey;
}

export function editingForm(form: HTMLFormElement | null): HTMLFormElement | null {
  if (!form) return null;
  if (
    form.id === "record-form" ||
    form.id === "style-form" ||
    form.id === "asset-detail" ||
    form.id === "folder-detail" ||
    form.hasAttribute("data-sheet") ||
    form.hasAttribute("data-runtime-raw") ||
    form.hasAttribute("data-dataset-records-raw")
  ) {
    return form;
  }
  return null;
}

/**
 * Run the editor Save action for Cmd/Ctrl+S. Returns true when the shortcut was handled
 * (including "nothing to save" toast).
 */
export function triggerEditorSave(root: ParentNode, event: KeyboardEvent): boolean {
  if (!isEditorSaveShortcut(event)) return false;
  if (event.defaultPrevented) return false;

  const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
  const topDialog = dialogs[dialogs.length - 1];
  if (topDialog) {
    event.preventDefault();
    const recordForm = topDialog.querySelector("#dataset-record-form");
    if (recordForm instanceof HTMLFormElement) {
      recordForm.requestSubmit();
      return true;
    }
    const overlayForm: HTMLFormElement | null =
      topDialog instanceof HTMLFormElement
        ? topDialog
        : topDialog.querySelector<HTMLFormElement>("form");
    if (overlayForm && editingForm(overlayForm)) {
      overlayForm.requestSubmit();
    }
    return true;
  }

  const datasetSave = document.querySelector<HTMLButtonElement>(
    ".editor-dataset-setup [data-dataset-save]:not([disabled])",
  );
  if (datasetSave?.isConnected) {
    event.preventDefault();
    datasetSave.click();
    return true;
  }

  const gridSave = document.querySelector<HTMLButtonElement>("[data-dataset-save-grid]:not([disabled])");
  if (gridSave?.isConnected) {
    event.preventDefault();
    gridSave.click();
    return true;
  }

  const active = document.activeElement;
  const focused = active instanceof HTMLElement ? active.closest("form") : null;
  const form =
    editingForm(focused instanceof HTMLFormElement ? focused : null) ??
    root.querySelector<HTMLFormElement>("#record-form") ??
    root.querySelector<HTMLFormElement>("#style-form") ??
    document.querySelector<HTMLFormElement>("#record-form") ??
    document.querySelector<HTMLFormElement>("#style-form");
  event.preventDefault();
  if (form) {
    form.requestSubmit();
    return true;
  }
  showEditorToast("Nothing was saved.", { tone: "neutral" });
  return true;
}
