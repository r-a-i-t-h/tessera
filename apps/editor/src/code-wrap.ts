import { escapeHtml } from "./dom.js";

const KEY = "tessera.editor.codeWrap";

/** Whether monospace YAML/raw editors should soft-wrap. */
export function readCodeWrap(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function writeCodeWrap(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // localStorage unavailable
  }
}

/** Class fragment for textareas when wrap is on (leading space). */
export function codeWrapClass(): string {
  return readCodeWrap() ? " editor-code-wrap" : "";
}

/** Checkbox that toggles wrap; leave `name` unset so it never submits with the form. */
export function codeWrapToggle(textareaId?: string): string {
  const checked = readCodeWrap() ? " checked" : "";
  const controls = textareaId ? ` aria-controls="${escapeHtml(textareaId)}"` : "";
  return `<label class="editor-check editor-code-wrap-toggle"><input type="checkbox" data-code-wrap${controls}${checked} /> Word wrap</label>`;
}

export function isCodeWrapToggle(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && target.hasAttribute("data-code-wrap");
}

const CODE_AREA =
  "textarea.editor-yaml, textarea.editor-raw, textarea[data-kind='yaml'], textarea[data-kind='json']";

/** Keep wrap checkboxes and code textareas in sync under `root`. */
export function bindCodeWrap(root: ParentNode): void {
  applyCodeWrap(root, readCodeWrap());
  root.addEventListener("change", (event) => {
    if (!isCodeWrapToggle(event.target)) return;
    const on = (event.target as HTMLInputElement).checked;
    writeCodeWrap(on);
    applyCodeWrap(root, on);
  });
}

function applyCodeWrap(root: ParentNode, on: boolean): void {
  for (const box of root.querySelectorAll<HTMLInputElement>("[data-code-wrap]")) {
    box.checked = on;
  }
  for (const area of root.querySelectorAll<HTMLTextAreaElement>(CODE_AREA)) {
    area.classList.toggle("editor-code-wrap", on);
  }
}
