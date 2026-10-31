export const COMPOSE_LIST_EXPANDED_LABEL = "Collapse editors";
export const COMPOSE_LIST_COLLAPSED_LABEL = "Expand editors";

/** True when a modal dialog is open (Escape is handled on the dialog host). */
export function hasOpenModal(): boolean {
  return Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'));
}

export type EscapeHandlers = {
  onLibraryAddClose?: () => void;
};

/**
 * Cancel the current inline operation, or navigate back. Returns true when Escape was handled.
 */
export function handleEscape(root: ParentNode, handlers?: EscapeHandlers): boolean {
  if (cancelCreationForm(root)) return true;
  if (cancelBindingWizard(root)) return true;
  if (cancelLibraryAssetDetail(root)) return true;
  if (cancelHistoryView(root)) return true;
  if (cancelComposeListMode(root)) return true;
  if (closeLibraryAddPanel(root)) {
    handlers?.onLibraryAddClose?.();
    return true;
  }
  if (cancelDatasetGridEdit(root)) return true;
  if (followBackLink(root)) return true;
  if (followLibraryParent(root)) return true;
  return false;
}

function cancelCreationForm(root: ParentNode): boolean {
  const form = root.querySelector<HTMLFormElement>("form.editor-new-page:not([hidden]):not(#new-binding-form)");
  if (!form) return false;
  form.hidden = true;
  clearFormError(form);
  form.querySelector<HTMLButtonElement>("button[type=submit]")?.removeAttribute("disabled");
  return true;
}

/** Same action as Escape on the new-binding form (step back, or close on the first step). */
export function cancelNewBindingForm(form: HTMLFormElement): boolean {
  const back = form.querySelector<HTMLButtonElement>('[data-binding-step="back"]');
  if (back) {
    back.click();
    return true;
  }
  form.hidden = true;
  clearFormError(form);
  return true;
}

function cancelBindingWizard(root: ParentNode): boolean {
  const form = root.querySelector<HTMLFormElement>("#new-binding-form");
  if (!form || form.hidden) return false;
  return cancelNewBindingForm(form);
}

function cancelLibraryAssetDetail(root: ParentNode): boolean {
  const detail = root.querySelector<HTMLElement>("#library-detail");
  if (!detail?.querySelector("#asset-detail, #folder-detail")) return false;
  detail.innerHTML = "<p><strong>Details</strong></p>";
  root.querySelectorAll(".editor-library-row-active").forEach((row) => row.classList.remove("editor-library-row-active"));
  return true;
}

function cancelHistoryView(root: ParentNode): boolean {
  const view = root.querySelector<HTMLElement>("#history-view");
  if (!view || view.hidden) return false;
  view.hidden = true;
  view.textContent = "";
  return true;
}

function cancelComposeListMode(root: ParentNode): boolean {
  const form = root.querySelector<HTMLFormElement>("#record-form");
  if (!form?.classList.contains("editor-compose-list")) return false;
  form.classList.remove("editor-compose-list");
  const toggle = form.querySelector<HTMLElement>("[data-compose-list]");
  toggle?.setAttribute("aria-pressed", "false");
  if (toggle) toggle.textContent = COMPOSE_LIST_EXPANDED_LABEL;
  return true;
}

function closeLibraryAddPanel(root: ParentNode): boolean {
  const panel = root.querySelector<HTMLDetailsElement>("#library-add");
  if (!panel?.open) return false;
  panel.open = false;
  return true;
}

function cancelDatasetGridEdit(root: ParentNode): boolean {
  const cancel = root.querySelector<HTMLButtonElement>("[data-dataset-cancel-grid]");
  if (!cancel) return false;
  cancel.click();
  return true;
}

function followBackLink(root: ParentNode): boolean {
  const back = root.querySelector<HTMLAnchorElement>(".editor-back");
  const hash = back?.getAttribute("href");
  if (!hash) return false;
  navigateHash(hash);
  return true;
}

function followLibraryParent(root: ParentNode): boolean {
  const hash = libraryParentHash(root);
  if (!hash) return false;
  navigateHash(hash);
  return true;
}

export function libraryParentHash(root: ParentNode): string | undefined {
  const crumbs = root.querySelector(".editor-crumbs");
  if (!crumbs) return undefined;
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (!hash.startsWith("library/")) return undefined;
  const links = [...crumbs.querySelectorAll<HTMLAnchorElement>("a")];
  if (!links.length) return undefined;
  return links[links.length - 1]?.getAttribute("href") ?? undefined;
}

function navigateHash(hash: string): void {
  if (window.location.hash === hash) return;
  window.location.hash = hash;
}

function clearFormError(form: HTMLFormElement): void {
  const error = form.querySelector<HTMLElement>("[data-form-error]");
  if (!error) return;
  error.hidden = true;
  error.textContent = "";
}
