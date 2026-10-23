import { decodeHtmlEntitiesOnce, sanitizeRichHtml } from "@r-a-i-t-h/tessera-model";
import { escapeHtml } from "./dom.js";

function markButton(cmd: string, label: string, glyph: string): string {
  return `<button type="button" class="editor-mark" data-html-cmd="${cmd}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${glyph}</button>`;
}

function toolbarHtml(): string {
  return `<span class="editor-section-editing-tools"><span class="editor-inline">${[
    markButton("bold", "Bold", "<b>B</b>"),
    markButton("italic", "Italic", "<i>I</i>"),
    markButton("underline", "Underline", "<u>U</u>"),
    markButton("strikeThrough", "Strikethrough", "<s>S</s>"),
    markButton("removeFormat", "Clear formatting", "⌫"),
    markButton("insertUnorderedList", "Bulleted list", "•"),
    markButton("insertOrderedList", "Numbered list", "1."),
  ].join("")}</span></span>`;
}

export function renderHtmlEditor(initial: string, id: string): string {
  const body = sanitizeRichHtml(decodeHtmlEntitiesOnce(initial));
  return `<div class="editor-html-field" data-html-editor>
    ${toolbarHtml()}
    <div id="${escapeHtml(id)}" class="editor-text-body w3-input w3-border" contenteditable="true" data-html-body data-placeholder="Write…">${body}</div>
  </div>`;
}

export function readHtmlEditor(host: HTMLElement): string {
  const body = host.querySelector<HTMLElement>("[data-html-body]");
  if (!body) return "";
  return sanitizeRichHtml(body.innerHTML);
}

export function mountHtmlEditor(host: HTMLElement): void {
  host.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-html-cmd]");
    if (!button?.dataset.htmlCmd) return;
    event.preventDefault();
    const cmd = button.dataset.htmlCmd;
    const body = host.querySelector<HTMLElement>("[data-html-body]");
    if (!body) return;
    body.focus();
    if (cmd === "removeFormat") {
      document.execCommand("removeFormat");
      document.execCommand("unlink");
      return;
    }
    if (cmd === "bold" || cmd === "italic" || cmd === "underline" || cmd === "strikeThrough") {
      document.execCommand(cmd);
      return;
    }
    if (cmd === "insertUnorderedList" || cmd === "insertOrderedList") {
      document.execCommand("defaultParagraphSeparator", false, "p");
      document.execCommand(cmd);
    }
  });
}

export function plainTextFromHtml(html: string): string {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  }
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
