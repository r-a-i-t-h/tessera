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

export function noticePanel(message: string): string {
  return message
    ? `<p class="w3-panel w3-pale-green" role="status">${escapeHtml(message)}</p>`
    : "";
}

export function errorPanel(message: string): string {
  return message
    ? `<p class="w3-panel w3-pale-red" role="alert">${escapeHtml(message)}</p>`
    : "";
}

export function statusPanels(notice: string, error: string): string {
  return `${noticePanel(notice)}
    ${errorPanel(error)}`;
}

let editorToastHideTimer: ReturnType<typeof setTimeout> | undefined;

/** Brief fixed toast for editor chrome (survives #app re-renders). */
export function showEditorToast(message: string, durationMs = 2400): void {
  let el = document.getElementById("editor-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "editor-toast";
    el.className = "editor-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  if (editorToastHideTimer) clearTimeout(editorToastHideTimer);
  el.textContent = message;
  el.hidden = false;
  el.classList.add("editor-toast--visible");
  editorToastHideTimer = setTimeout(() => {
    el.classList.remove("editor-toast--visible");
    editorToastHideTimer = setTimeout(() => {
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
