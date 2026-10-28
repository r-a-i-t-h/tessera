import { escapeHtml, fieldId } from "./dom.js";

export function rawHtmlInsertToolbar(fieldName: string): string {
  const name = escapeHtml(fieldName);
  return `<p><button type="button" class="w3-button w3-small w3-white" data-insert="image" data-target="${name}">Image</button>
    <button type="button" class="w3-button w3-small w3-white" data-insert="document" data-target="${name}">Document</button></p>`;
}

export function rawHtmlField(name: string, label: string, value: string, rows: number, extraClass = ""): string {
  const id = fieldId(name);
  return `${rawHtmlInsertToolbar(name)}<p><label for="${id}">${escapeHtml(label)}</label>
    <textarea id="${id}" name="${escapeHtml(name)}" rows="${rows}" spellcheck="false" class="w3-input w3-border w3-margin-top editor-html${extraClass}">${escapeHtml(value)}</textarea></p>`;
}

export function layoutStaticHtmlField(value: string): string {
  return `<p><label>HTML <textarea class="w3-input w3-border editor-html" data-field="html" rows="14" spellcheck="false">${escapeHtml(value)}</textarea></label></p>`;
}
