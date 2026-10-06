import { escapeHtml } from "./dom.js";

export const REORDER_ICONS = {
  up: `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M3.2 10.4 8 4.4l4.8 6"/></svg>`,
  down: `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M3.2 5.6 8 11.6l4.8-6"/></svg>`,
  remove: `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M3.6 3.6 12.4 12.4M12.4 3.6 3.6 12.4"/></svg>`,
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
