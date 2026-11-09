import { activateDialog, type DialogController } from "./dialog.js";
import { escapeHtml } from "./dom.js";
import { hasOpenModal } from "./escape-key.js";
import { isTypingTarget } from "./typing-target.js";

export type ShortcutRow = { keys: string; action: string };

/** Chords use {mod} as placeholder for ⌘ or Ctrl. */
export const SHORTCUT_SECTIONS: { title: string; rows: ShortcutRow[] }[] = [
  {
    title: "General",
    rows: [
      { keys: "{mod}+S", action: "Save" },
      { keys: "{mod}+A", action: "Add (list pages; not while typing in a field)" },
      { keys: "{mod}+E", action: "Edit — grid edit mode or focus first form field" },
      { keys: "{mod}+Shift+O", action: "Open another (entity opener)" },
      { keys: "{mod}+Shift+P", action: "Command palette" },
      { keys: "?", action: "Keyboard shortcuts (this dialog)" },
      { keys: "Escape", action: "Leave field focus while typing; otherwise cancel, back, or close palette" },
    ],
  },
  {
    title: "While editing a record",
    rows: [
      { keys: "] / [", action: "Next / previous editing tab (not while typing in a field)" },
      { keys: "{mod}+Z", action: "Undo" },
      { keys: "{mod}+Shift+Z or {mod}+Y", action: "Redo" },
    ],
  },
  {
    title: "Data grid",
    rows: [{ keys: "{mod}+S", action: "Save grid (while Edit grid is active)" }],
  },
  {
    title: "Compose",
    rows: [{ keys: "{mod}+K", action: "Insert link (in text fields)" }],
  },
  {
    title: "Lists and pickers",
    rows: [
      { keys: "↑ ↓", action: "Move selection" },
      { keys: "Enter or Space", action: "Activate row" },
    ],
  },
];

function modLabel(): string {
  if (typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform)) {
    return "⌘";
  }
  return "Ctrl";
}

function formatKeys(template: string): string {
  return template.replaceAll("{mod}", modLabel());
}

let host: HTMLElement | null = null;
let dialog: DialogController | null = null;

export function isShortcutsHelpOpen(): boolean {
  return Boolean(dialog);
}

export function isShortcutsHelpKey(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  if (event.defaultPrevented) return false;
  if (!isShortcutsHelpOpen() && isTypingTarget(event.target)) return false;
  return event.key === "?" || (event.code === "Slash" && event.shiftKey);
}

function shortcutsHelpHtml(): string {
  const sections = SHORTCUT_SECTIONS.map((section) => {
    const rows = section.rows
      .map(
        (row) =>
          `<div class="editor-shortcuts-help-row"><dt>${escapeHtml(formatKeys(row.keys))}</dt><dd>${escapeHtml(row.action)}</dd></div>`,
      )
      .join("");
    return `<section class="editor-shortcuts-help-section"><h3 class="w3-medium">${escapeHtml(section.title)}</h3><dl class="editor-shortcuts-help-dl">${rows}</dl></section>`;
  }).join("");
  return `<div class="editor-picker-backdrop" data-dialog-backdrop>
    <div class="w3-card w3-white w3-padding editor-card editor-shortcuts-help-dialog" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" tabindex="-1">
      <button type="button" class="editor-dialog-close" data-shortcuts-help-close aria-label="Close">×</button>
      <h2 class="w3-large">Keyboard shortcuts</h2>
      ${sections}
      <p class="w3-text-grey w3-small editor-shortcuts-help-footer">Press ? to close</p>
    </div>
  </div>`;
}

export function closeShortcutsHelp(): void {
  dialog?.destroy();
  dialog = null;
  host?.remove();
  host = null;
}

/** Open the shortcuts dialog. Returns false when blocked by another modal. */
export function openShortcutsHelp(returnFocus?: HTMLElement | null): boolean {
  if (hasOpenModal() && !isShortcutsHelpOpen()) return false;
  if (isShortcutsHelpOpen()) return true;
  host = document.createElement("div");
  host.className = "editor-shortcuts-help-host";
  host.innerHTML = shortcutsHelpHtml();
  const finish = () => closeShortcutsHelp();
  host.querySelector("[data-shortcuts-help-close]")?.addEventListener("click", finish);
  host.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.hasAttribute("data-dialog-backdrop")) {
      finish();
    }
  });
  document.body.appendChild(host);
  dialog = activateDialog(host, { onCancel: finish, returnFocus: returnFocus ?? undefined, closeOnBackdrop: true });
  return true;
}

export function toggleShortcutsHelp(returnFocus?: HTMLElement | null): boolean {
  if (isShortcutsHelpOpen()) {
    closeShortcutsHelp();
    return true;
  }
  return openShortcutsHelp(returnFocus);
}

/** Handle ? when bound at document level. */
export function handleShortcutsHelpKey(event: KeyboardEvent): boolean {
  if (!isShortcutsHelpKey(event)) return false;
  if (isShortcutsHelpOpen()) {
    event.preventDefault();
    closeShortcutsHelp();
    return true;
  }
  if (hasOpenModal()) return false;
  event.preventDefault();
  openShortcutsHelp(event.target instanceof HTMLElement ? event.target : undefined);
  return true;
}
