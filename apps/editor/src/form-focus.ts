const EDIT_SCOPE_SELECTORS = [
  "#record-form",
  "#edit-user-form",
  "#username-form",
  "#password-form",
  "#style-form",
  "#asset-detail",
  "#folder-detail",
  "#runtime-module-form",
  ".editor-dataset-setup .editor-tab-body",
  "#login-form",
  "#new-user-form",
  ".editor-dataset-record-dialog form",
];

const EDITABLE_SELECTOR = [
  'input:not([type="hidden"]):not([disabled]):not([readonly]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([readonly]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  '[contenteditable="true"]:not([tabindex="-1"])',
].join(",");

function isVisibleField(el: HTMLElement): boolean {
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

/** Focus the first visible editable control in a known editor form. */
export function focusFirstEditableField(root: ParentNode): boolean {
  for (const scopeSelector of EDIT_SCOPE_SELECTORS) {
    const scope = root.querySelector(scopeSelector);
    if (!scope) continue;
    for (const el of scope.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR)) {
      if (!isVisibleField(el)) continue;
      el.focus();
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        return true;
      }
      if (el.isContentEditable) return true;
    }
  }
  return false;
}
