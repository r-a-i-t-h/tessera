import { escapeHtml, fieldId } from "./dom.js";
import { RAW_HTML_INSERT_ICONS } from "./editor-icons.js";
import { documentLink, imageTag, type PickedAsset, type PickerMode } from "./forms/picker.js";
import {
  pageRefAnchor,
  pageTitleFromChoices,
  parsePageTargetChoices,
  type PageTargetChoices,
} from "./forms/page-target.js";

export const ARRANGE_STATIC_HTML_TARGET = "arrange-static-html";

function insertMarkButton(insert: string, target: string, label: string, icon: string): string {
  const t = escapeHtml(target);
  return `<button type="button" class="editor-mark" data-insert="${insert}" data-target="${t}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${icon}</button>`;
}

export function rawHtmlInsertToolbar(insertTarget: string): string {
  return `<span class="editor-raw-html-tools editor-inline">${[
    insertMarkButton("image", insertTarget, "Image", RAW_HTML_INSERT_ICONS.image),
    insertMarkButton("document", insertTarget, "Document", RAW_HTML_INSERT_ICONS.document),
    insertMarkButton("page", insertTarget, "Page link", RAW_HTML_INSERT_ICONS.page),
  ].join("")}</span>`;
}

export function rawHtmlField(name: string, label: string, value: string, rows: number, extraClass = ""): string {
  const id = fieldId(name);
  const target = escapeHtml(name);
  return `<p class="editor-raw-html"><label for="${id}">${escapeHtml(label)}</label>
    ${rawHtmlInsertToolbar(name)}
    <textarea id="${id}" name="${target}" data-raw-html-target="${target}" rows="${rows}" spellcheck="false" class="w3-input w3-border editor-html${extraClass}">${escapeHtml(value)}</textarea></p>`;
}

export function layoutStaticHtmlField(value: string): string {
  const target = ARRANGE_STATIC_HTML_TARGET;
  return `<p class="editor-raw-html"><label class="editor-raw-html-label">HTML</label>
    ${rawHtmlInsertToolbar(target)}
    <textarea class="w3-input w3-border editor-html" data-field="html" data-raw-html-target="${target}" rows="14" spellcheck="false">${escapeHtml(value)}</textarea></p>`;
}

export type RawHtmlFieldOptions = {
  openLibraryPicker: (
    mode: PickerMode,
  ) => Promise<PickedAsset | { id: string; kind: "folder" } | undefined>;
  openPageTargetPicker: (
    choices: PageTargetChoices,
    current: string,
    returnFocus?: HTMLElement | null,
  ) => Promise<string | undefined>;
  onDirty: (form: HTMLFormElement) => void;
};

const bound = new WeakSet<HTMLFormElement>();

export function bindRawHtmlField(form: HTMLFormElement, options: RawHtmlFieldOptions): void {
  if (bound.has(form)) return;
  bound.add(form);
  form.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest("button");
    if (!button?.dataset.insert || !button.dataset.target) return;
    const insert = button.dataset.insert;
    if (insert !== "image" && insert !== "document" && insert !== "page") return;
    event.preventDefault();
    void insertRawHtml(form, insert, button.dataset.target, options);
  });
}

function resolveRawHtmlTextarea(form: HTMLFormElement, target: string): HTMLTextAreaElement | null {
  const byTarget = form.querySelector<HTMLTextAreaElement>(
    `[data-raw-html-target="${CSS.escape(target)}"]`,
  );
  if (byTarget) return byTarget;
  const byName = form.querySelector<HTMLTextAreaElement>(`[name="${CSS.escape(target)}"]`);
  return byName instanceof HTMLTextAreaElement ? byName : null;
}

async function insertRawHtml(
  form: HTMLFormElement,
  insert: string,
  target: string,
  options: RawHtmlFieldOptions,
): Promise<void> {
  const control = resolveRawHtmlTextarea(form, target);
  if (!control) return;

  if (insert === "page") {
    const encoded = form.querySelector<HTMLInputElement>("[data-page-target-choices]")?.dataset.pageTargetChoices;
    const choices = parsePageTargetChoices(encoded);
    if (!choices) return;
    const picked = await options.openPageTargetPicker(choices, "", control);
    if (picked === undefined) return;
    const text = pageInsertSnippet(picked, choices);
    if (!text) return;
    insertAtCursor(control, text);
    options.onDirty(form);
    return;
  }

  const mode: PickerMode = insert === "document" ? "document" : "image";
  const picked = await options.openLibraryPicker(mode);
  if (!picked || !("url" in picked)) return;
  const text = insert === "document" ? documentLink(picked) : imageTag(picked);
  insertAtCursor(control, text);
  options.onDirty(form);
}

function pageInsertSnippet(picked: string, choices: PageTargetChoices): string {
  const trimmed = picked.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) {
    const label = trimmed.replace(/</g, "");
    return `<a href="${escapeHtml(trimmed)}">${escapeHtml(label)}</a>`;
  }
  const title = pageTitleFromChoices(choices, trimmed) ?? trimmed;
  return pageRefAnchor(trimmed, title);
}

function insertAtCursor(el: HTMLTextAreaElement, text: string): void {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  el.value = `${el.value.slice(0, start)}${text}${el.value.slice(end)}`;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
