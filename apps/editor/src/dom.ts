export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fieldId(name: string): string {
  return `f-${name.replace(/[^a-zA-Z0-9]+/g, "-")}`;
}

export type EditorToastTone = "success" | "neutral";

export type EditorToastOptions = {
  tone?: EditorToastTone;
  /** Opens in a new tab; shown as a link icon beside the message. */
  href?: string;
  durationMs?: number;
};

const TOAST_LINK_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

/** Time on screen scales with message length (long multi-line notices stay readable). */
export function editorToastDurationMs(message: string): number {
  const len = message.trim().length;
  return Math.min(14_000, Math.max(2400, 1800 + len * 42));
}

export function noticePanel(message: string): string {
  if (message) showEditorToast(message, { tone: "success" });
  return "";
}

export function errorPanel(message: string): string {
  return message
    ? `<p class="w3-panel w3-pale-red" role="alert">${escapeHtml(message)}</p>`
    : "";
}

export function statusPanels(notice: string, error: string): string {
  noticePanel(notice);
  return errorPanel(error);
}

let editorToastHideTimer: ReturnType<typeof setTimeout> | undefined;
let editorToastRemoveTimer: ReturnType<typeof setTimeout> | undefined;

/** Brief fixed toast for editor chrome (survives #app re-renders). */
export function showEditorToast(message: string, options?: EditorToastOptions): void {
  let el = document.getElementById("editor-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "editor-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }

  const tone = options?.tone ?? "success";
  const durationMs = options?.durationMs ?? editorToastDurationMs(message);
  const href = options?.href?.trim();

  if (editorToastHideTimer) clearTimeout(editorToastHideTimer);
  if (editorToastRemoveTimer) clearTimeout(editorToastRemoveTimer);

  el.className = `editor-toast editor-toast--${tone}`;
  el.replaceChildren();

  const text = document.createElement("p");
  text.className = "editor-toast-text";
  text.textContent = message;
  el.append(text);

  if (href) {
    const link = document.createElement("a");
    link.className = "editor-toast-link";
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Open link in new tab");
    link.innerHTML = TOAST_LINK_ICON;
    el.append(link);
  }

  el.hidden = false;
  el.classList.add("editor-toast--visible");
  editorToastHideTimer = setTimeout(() => {
    el.classList.remove("editor-toast--visible");
    editorToastRemoveTimer = setTimeout(() => {
      el.hidden = true;
    }, 180);
  }, durationMs);
}

export function formErrorPanel(): string {
  return `<p data-form-error class="w3-panel w3-pale-red" role="alert" hidden></p>`;
}

export function showFormError(form: HTMLFormElement, message: string): void {
  const error = form.querySelector<HTMLElement>("[data-form-error]");
  if (!error) return;
  error.hidden = false;
  error.textContent = message;
}
