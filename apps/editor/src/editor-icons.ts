import { escapeHtml } from "./dom.js";

/** Person icon for the signed-in account link in the editor sidebar. */
export const EDITOR_SIDEBAR_USER_ICON = `<svg class="editor-sidebar-account-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="5.2" r="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M3.5 13.5c.8-2.2 2.6-3.5 4.5-3.5s3.7 1.3 4.5 3.5"/></svg>`;

export const REORDER_ICONS = {
  up: `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M3.2 10.4 8 4.4l4.8 6"/></svg>`,
  down: `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M3.2 5.6 8 11.6l4.8-6"/></svg>`,
  remove: `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M3.6 3.6 12.4 12.4M12.4 3.6 3.6 12.4"/></svg>`,
  hide: `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4Z"/><circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
  show: `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4"/><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M2.2 13.2 13.8 2.6"/></svg>`,
} as const;

/** Icons for raw HTML insert toolbar (Items, layout static HTML). */
export const RAW_HTML_INSERT_ICONS = {
  image: `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="5.5" cy="6.5" r="1.2" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M3.5 11.5 6.5 8.5 8.5 10 11 7.5 12.5 11.5"/></svg>`,
  document: `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" d="M4.5 2.5h5.2L12.5 5.3V13a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"/><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M9.5 2.6V5.5H12.2"/><path fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" d="M5.5 8h5M5.5 10.5h5"/></svg>`,
  page: `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M6.8 9.2 9.2 6.8"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M7.2 4.5 8.3 3.4a2.2 2.2 0 0 1 3.1 3.1L10.3 7.6M8.8 11.5 7.7 12.6a2.2 2.2 0 0 1-3.1-3.1L5.7 8.4"/></svg>`,
} as const;

export function iconButton(options: {
  className: string;
  label: string;
  actionAttribute: string;
  action: string;
  indexAttribute: string;
  index: number;
  icon: string;
  extraAttributes?: string;
}): string {
  return `<button type="button" class="${escapeHtml(options.className)}" aria-label="${escapeHtml(options.label)}" title="${escapeHtml(options.label)}" ${options.actionAttribute}="${escapeHtml(options.action)}" ${options.indexAttribute}="${options.index}"${options.extraAttributes ?? ""}>${options.icon}</button>`;
}
