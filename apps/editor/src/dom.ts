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

export function formErrorPanel(): string {
  return `<p data-form-error class="w3-panel w3-pale-red" role="alert" hidden></p>`;
}
