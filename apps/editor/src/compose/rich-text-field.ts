import { renderMarkdownLinks } from "@r-a-i-t-h/tessera-sections";
import { hasOpenModal } from "../escape-key.js";

export type PageLinkPick =
  | { kind: "page"; id: string; title?: string }
  | { kind: "url"; href: string };

export type RichTextFieldOptions = {
  getContext: () => {
    pickPageLink?: (
      current: string,
      options?: { returnFocus?: HTMLElement | null },
    ) => Promise<PageLinkPick | undefined>;
    pageTitles: Map<string, string>;
  } | undefined;
  onDirty: (form: HTMLFormElement) => void;
};

const bound = new WeakSet<HTMLFormElement>();

export function bindRichTextField(form: HTMLFormElement, options: RichTextFieldOptions): void {
  if (bound.has(form)) return;
  bound.add(form);
  form.addEventListener("keydown", (event) => handleRichTextKeydown(form, event, options));
  form.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.dataset.blocks !== "true") return;
    if (selectionInsidePre()) return;
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      // ignore
    }
  });
  form.addEventListener("paste", (event) => onPaste(event));
}

export function runRichTextCommand(form: HTMLFormElement, command: string, options: RichTextFieldOptions): void {
  runCommand(form, command, options);
}

export function handleRichTextKeydown(form: HTMLFormElement, event: KeyboardEvent, options: RichTextFieldOptions): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (event.key === "Enter") {
    if (target.dataset.field === "heading") {
      event.preventDefault();
      return;
    }
    if (
      target.dataset.plain === "true" &&
      target.dataset.field === "text" &&
      target.closest(".tessera-quote")
    ) {
      event.preventDefault();
      insertSoftBreak();
      return;
    }
    if (
      target.dataset.plain === "true" &&
      target.dataset.field === "text" &&
      !target.closest(".tessera-quote")
    ) {
      event.preventDefault();
      return;
    }
    if (target.dataset.blocks === "true" && selectionInsidePre()) {
      event.preventDefault();
      insertSoftBreak();
      return;
    }
    if (
      target.dataset.blocks === "true" &&
      (event.shiftKey || event.ctrlKey) &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      insertSoftBreak();
      return;
    }
  }
  if (
    event.code !== "KeyK" ||
    event.altKey ||
    event.shiftKey ||
    !(event.metaKey || event.ctrlKey) ||
    hasOpenModal()
  ) {
    return;
  }
  if (!linkCommandField(target, form)) return;
  event.preventDefault();
  runCommand(form, "link", options);
}

export function editingToolbar(inline: string, list = ""): string {
  return `<span class="editor-section-editing-tools"><span class="editor-prop">${inline}${list}</span></span>`;
}

export function inlineTools(): string {
  return `<span class="editor-inline">${[
    markButton("bold", "Bold", "<b>B</b>"),
    markButton("italic", "Italic", "<i>I</i>"),
    markButton("underline", "Underline", "<u>U</u>"),
    markButton("strikeThrough", "Strikethrough", "<s>S</s>"),
    markButton("code", "Code", `<span class="editor-mark-code">&lt;/&gt;</span>`),
    markButton("codeBlock", "Code block", `<span class="editor-mark-code">{ }</span>`),
    markGap(),
    markButton("link", "Link", LINK_ICON),
    markButton("removeFormat", "Clear formatting", CLEAR_ICON),
  ].join("")}</span>`;
}

export function listTools(): string {
  return `<span class="editor-inline">${[
    markButton("insertUnorderedList", "Bulleted list", LIST_ICON),
    markButton("insertOrderedList", "Numbered list", NUMBER_ICON),
    markGap(),
    markButton("align:w3-left-align", "Align left", ALIGN_LEFT_ICON),
    markButton("align:w3-center", "Align center", ALIGN_CENTER_ICON),
    markButton("align:w3-right-align", "Align right", ALIGN_RIGHT_ICON),
    markButton("align:w3-justify", "Justify", ALIGN_JUSTIFY_ICON),
  ].join("")}</span>`;
}

function markButton(cmd: string, label: string, glyph: string): string {
  return `<button type="button" class="editor-mark" data-cmd="${cmd}" aria-label="${escapeAttr(label)}" title="${escapeAttr(label)}">${glyph}</button>`;
}

function markGap(): string {
  return `<span class="editor-mark-gap" aria-hidden="true"></span>`;
}

const LINK_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M6.8 9.2 9.2 6.8"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M7.2 4.5 8.3 3.4a2.2 2.2 0 0 1 3.1 3.1L10.3 7.6M8.8 11.5 7.7 12.6a2.2 2.2 0 0 1-3.1-3.1L5.7 8.4"/></svg>`;
const CLEAR_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" d="m3.4 10.2 4.8-6.4 4.4 3.3-4.8 6.4H5.2z"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M8.2 13.4h5"/></svg>`;
const LIST_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="4" r="1.05" fill="currentColor"/><circle cx="3" cy="8" r="1.05" fill="currentColor"/><circle cx="3" cy="12" r="1.05" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M6 4h7.2M6 8h7.2M6 12h7.2"/></svg>`;
const NUMBER_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><text x="0.4" y="5" font-size="4.6" font-family="ui-sans-serif, system-ui, sans-serif" fill="currentColor">1</text><text x="0.4" y="9.3" font-size="4.6" font-family="ui-sans-serif, system-ui, sans-serif" fill="currentColor">2</text><text x="0.4" y="13.6" font-size="4.6" font-family="ui-sans-serif, system-ui, sans-serif" fill="currentColor">3</text><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M6 3.6h7.2M6 7.9h7.2M6 12.2h7.2"/></svg>`;
const ALIGN_LEFT_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M2.5 3.5h11M2.5 7h7M2.5 10.5h11M2.5 14h5"/></svg>`;
const ALIGN_CENTER_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M2.5 3.5h11M4.5 7h7M2.5 10.5h11M5.5 14h5"/></svg>`;
const ALIGN_RIGHT_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M2.5 3.5h11M6.5 7h7M2.5 10.5h11M8.5 14h5"/></svg>`;
const ALIGN_JUSTIFY_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M2.5 3.5h11M2.5 7h11M2.5 10.5h11M2.5 14h11"/></svg>`;
const ALIGN_CLASS = ["w3-left-align", "w3-right-align", "w3-center", "w3-text-center", "w3-justify"];

function linkCommandField(target: EventTarget | null, form: HTMLFormElement): boolean {
  if (!target || typeof target !== "object" || !("dataset" in target)) return false;
  const field = target as HTMLElement;
  if (!field.isContentEditable && field.getAttribute("contenteditable") !== "true") return false;
  if (!form.contains(field)) return false;
  if (field.dataset.plain === "true") return false;
  return field.dataset.field === "html";
}

function runCommand(form: HTMLFormElement, command: string, options: RichTextFieldOptions): void {
  options.onDirty(form);
  if (command.startsWith("align:")) {
    alignBlock(command.slice("align:".length));
    return;
  }
  if (command === "link") {
    const state = options.getContext();
    const saved = cloneSelection();
    const editField = htmlEditFieldFromSelection();
    const current = selectionAnchor()?.getAttribute("data-tessera-page")
      ?? selectionAnchor()?.getAttribute("href")
      ?? "";
    void (async () => {
      const picked = state?.pickPageLink
        ? await state.pickPageLink(current, { returnFocus: editField })
        : await legacyPromptLink();
      restoreEditingCaret(saved, editField);
      if (!picked) return;
      if (picked.kind === "page") {
        const label =
          document.getSelection()?.toString()
          || picked.title
          || state?.pageTitles.get(picked.id)
          || picked.id;
        insertPageRef(picked.id, label);
      } else {
        if (/^\s*javascript:/i.test(picked.href)) return;
        insertMarkdownLink(picked.href);
      }
    })();
    return;
  }
  if (command === "code") {
    toggleCode();
    return;
  }
  if (command === "codeBlock") {
    toggleCodeBlock();
    return;
  }
  if (command === "removeFormat") {
    document.execCommand("removeFormat");
    document.execCommand("unlink");
    clearAlign();
    clearInlineFormatting();
    touchEditable();
    return;
  }
  if (command === "bold" || command === "italic" || command === "underline" || command === "strikeThrough") {
    document.execCommand(command);
    touchEditable();
    return;
  }
  if (command === "insertUnorderedList" || command === "insertOrderedList") {
    document.execCommand("defaultParagraphSeparator", false, "p");
    document.execCommand(command);
    touchEditable();
  }
}

function alignBlock(className: string): void {
  const block = currentBlock();
  if (!block) return;
  const on = block.classList.contains(className);
  for (const name of ALIGN_CLASS) block.classList.remove(name);
  if (!on) block.classList.add(className);
  touchEditable();
}

function clearAlign(): void {
  const block = currentBlock();
  if (!block) return;
  for (const name of ALIGN_CLASS) block.classList.remove(name);
}

function currentBlock(): HTMLElement | null {
  const sel = document.getSelection();
  const node = sel?.anchorNode;
  const el = node instanceof Element ? node : node?.parentElement;
  const editable = el?.closest<HTMLElement>("[contenteditable]");
  if (!editable || editable.dataset.blocks !== "true") return null;
  const block = el?.closest("p, ul, ol");
  return block instanceof HTMLElement && editable.contains(block) ? block : null;
}

function selectionInsidePre(): HTMLElement | null {
  const sel = document.getSelection();
  const node = sel?.anchorNode;
  const el = node instanceof Element ? node : node?.parentElement;
  const editable = el?.closest<HTMLElement>("[contenteditable]");
  if (!editable || editable.dataset.blocks !== "true") return null;
  const pre = el?.closest("pre.tessera-pre");
  return pre instanceof HTMLElement && editable.contains(pre) ? pre : null;
}

function insertSoftBreak(): void {
  try {
    if (!document.execCommand("insertLineBreak")) {
      document.execCommand("insertHTML", false, "<br>");
    }
  } catch {
    document.execCommand("insertHTML", false, "<br>");
  }
  touchEditable();
}

function toggleCode(): void {
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const anchor = sel.anchorNode;
  const from = anchor instanceof Element ? anchor : anchor?.parentElement;
  const editable = from?.closest("[contenteditable]");
  const code = from?.closest("code");
  if (code && editable?.contains(code)) {
    code.replaceWith(document.createTextNode(code.textContent ?? ""));
    touchEditable();
    return;
  }
  const text = sel.toString();
  if (!text) return;
  document.execCommand("insertHTML", false, `<code>${escapeText(text)}</code>`);
  touchEditable();
}

function toggleCodeBlock(): void {
  const pre = selectionInsidePre();
  if (pre) {
    const p = document.createElement("p");
    const text = pre.textContent ?? "";
    if (text) p.textContent = text;
    else p.append(document.createElement("br"));
    pre.replaceWith(p);
    placeCaretIn(p);
    touchEditable();
    return;
  }
  const block = currentBlock();
  if (block && block.tagName.toLowerCase() === "p") {
    const next = document.createElement("pre");
    next.className = "tessera-pre";
    const text = block.textContent ?? "";
    if (text) next.textContent = text;
    else next.append(document.createElement("br"));
    block.replaceWith(next);
    placeCaretIn(next);
    touchEditable();
    return;
  }
  document.execCommand("insertHTML", false, `<pre class="tessera-pre"><br></pre>`);
  touchEditable();
}

function placeCaretIn(el: HTMLElement): void {
  const sel = document.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function cloneSelection(): Range | null {
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  return sel.getRangeAt(0).cloneRange();
}

function restoreSelection(range: Range | null): void {
  if (!range) return;
  const sel = document.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

function htmlEditFieldFromSelection(): HTMLElement | null {
  const sel = document.getSelection();
  const node = sel?.anchorNode;
  const from = node instanceof Element ? node : node?.parentElement;
  const field = from?.closest<HTMLElement>('[contenteditable][data-field="html"]');
  return field?.isConnected ? field : null;
}

function restoreEditingCaret(range: Range | null, field: HTMLElement | null): void {
  if (field?.isConnected) field.focus({ preventScroll: true });
  if (!range?.startContainer.isConnected) return;
  restoreSelection(range);
}

function selectionAnchor(): HTMLAnchorElement | null {
  const sel = document.getSelection();
  const node = sel?.anchorNode;
  const from = node instanceof Element ? node : node?.parentElement;
  const editable = from?.closest("[contenteditable]");
  const link = from?.closest("a");
  return link instanceof HTMLAnchorElement && editable?.contains(link) ? link : null;
}

function clearInlineFormatting(): void {
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const from = node instanceof Element ? node : node.parentElement;
  const editable = from?.closest<HTMLElement>("[contenteditable]");
  if (!editable) return;
  const tags = ["b", "strong", "i", "em", "u", "s", "strike", "code", "span"];
  for (const tag of tags) {
    const hits = [...editable.querySelectorAll(tag)];
    for (const el of hits) {
      if (tag === "span" && !el.getAttribute("style")) continue;
      if (!range.intersectsNode(el) && !el.contains(range.startContainer)) continue;
      el.replaceWith(...el.childNodes);
    }
  }
}

function touchEditable(): void {
  const sel = document.getSelection();
  const node = sel?.anchorNode;
  const el = node instanceof Element ? node : node?.parentElement;
  el?.closest("[contenteditable]")?.dispatchEvent(new Event("input", { bubbles: true }));
}

function onPaste(event: ClipboardEvent): void {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.isContentEditable) return;
  event.preventDefault();
  if (target.dataset.plain === "true" || selectionInsidePre()) {
    document.execCommand("insertText", false, event.clipboardData?.getData("text/plain") ?? "");
    return;
  }
  const html = event.clipboardData?.getData("text/html") ?? "";
  const text = event.clipboardData?.getData("text/plain") ?? "";
  if (target.dataset.blocks === "true") {
    const pasted = html ? readTextHtml(html) : paragraphsFromPlain(text);
    if (pasted) document.execCommand("insertHTML", false, htmlForEditing(pasted));
    return;
  }
  document.execCommand(
    "insertHTML",
    false,
    html ? htmlForEditing(sanitize(html)) : escapeText(text).replace(/\n/g, "<br>"),
  );
}
const ALLOWED = new Set(["strong", "b", "em", "i", "u", "s", "code", "a", "br", "ul", "ol", "li", "p", "pre"]);

const MARKDOWN_LINK_SELECTION = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/;

export function htmlForEditing(stored: string): string {
  return normalizeLiteralNewlines(stored);
}

export function htmlFromEditing(innerHTML: string, blocks: boolean, titles?: Map<string, string>): string {
  const raw = blocks ? readTextHtml(innerHTML) : sanitize(innerHTML);
  return expandWikiLinks(renderMarkdownLinks(raw), titles);
}

function insertMarkdownLink(href: string): void {
  const trimmed = href.trim();
  if (!trimmed) return;
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const selected = sel.toString();
  const mdMatch = selected.match(MARKDOWN_LINK_SELECTION);
  const existing = selectionAnchor();
  if (existing) {
    existing.removeAttribute("data-tessera-page");
    existing.setAttribute("href", trimmed);
    if (!(existing.textContent ?? "").trim()) existing.textContent = trimmed;
    touchEditable();
    return;
  }
  const label = mdMatch?.[1] || selected || trimmed;
  document.execCommand("insertHTML", false, `<a href="${escapeAttr(trimmed)}">${escapeText(label)}</a>`);
  touchEditable();
}

function insertPageRef(pageId: string, label: string): void {
  const safeId = pageId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) return;
  const text = (label || safeId).replace(/</g, "");
  const existing = selectionAnchor();
  if (existing) {
    existing.setAttribute("data-tessera-page", safeId);
    existing.setAttribute("href", "#");
    if (!(existing.textContent ?? "").trim()) existing.textContent = text;
    touchEditable();
    return;
  }
  document.execCommand(
    "insertHTML",
    false,
    `<a data-tessera-page="${escapeAttr(safeId)}" href="#">${escapeText(text)}</a>`,
  );
  touchEditable();
}

async function legacyPromptLink(): Promise<PageLinkPick | undefined> {
  const href = window.prompt("Link address");
  if (!href || /^\s*javascript:/i.test(href)) return undefined;
  return { kind: "url", href };
}

const WIKI_LINK = /\[\[([a-zA-Z0-9_-]+)(?:\|([^\]]+))?\]\]/g;

/** Expand `[[page-id]]` / `[[page-id|label]]` into durable page anchors. */
export function expandWikiLinks(html: string, titles?: Map<string, string>): string {
  if (!html.includes("[[")) return html;
  return html.replace(WIKI_LINK, (_full, id: string, label?: string) => {
    const text = (label?.trim() || titles?.get(id) || id).replace(/</g, "");
    return `<a data-tessera-page="${escapeAttr(id)}" href="#">${escapeText(text)}</a>`;
  });
}

function paragraphsFromPlain(text: string): string {
  const parts: string[] = [];
  let current = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "\n") {
      let run = 0;
      while (i < text.length && text[i] === "\n") {
        run++;
        i++;
      }
      if (run >= 2) {
        parts.push(current);
        current = "";
        for (let blank = 0; blank < run - 2; blank++) parts.push("");
      } else {
        current += "\n";
      }
      continue;
    }
    current += text[i]!;
    i++;
  }
  parts.push(current);
  const html = parts
    .map((part) => {
      if (!part.trim()) return "<p><br></p>";
      return `<p>${escapeText(part).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
  return textBlocksHaveWords(html) ? html : "";
}

function readTextHtml(html: string): string {
  const normalized = normalizeLiteralNewlines(html);
  const doc = new DOMParser().parseFromString(`<div>${normalized}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  return root ? blocksIn(root) : "";
}

/** Map YAML / plain-text newlines to `<br>` and `<p>`, matching {@link paragraphsFromPlain}. */
function normalizeLiteralNewlines(html: string): string {
  if (!html.includes("\n")) return html;
  if (!/<\s*(p|div|ul|ol|pre|h[1-6]|li|table|blockquote)\b/i.test(html)) {
    return paragraphsFromPlain(html);
  }
  return html.replace(/<p(\s[^>]*)?>([\s\S]*?)<\/p>/gi, (full, attrs, inner: string) => {
    if (/<\s*(p|div|ul|ol|pre)\b/i.test(inner)) return full;
    if (!inner.includes("\n")) return full;
    const a = attrs ?? "";
    return inner
      .split(/\n\n+/)
      .map((part) => {
        const body = part.replace(/\n/g, "<br>");
        if (!body.replace(/<br\s*\/?>/gi, "").trim()) return `<p${a}><br></p>`;
        return `<p${a}>${body}</p>`;
      })
      .join("");
  });
}

function blocksIn(parent: Element): string {
  let out = "";
  let inline = "";
  const flush = () => {
    const cleaned = inline.trim();
    if (cleaned && cleaned !== "<br>") out += `<p>${cleaned}</p>`;
    inline = "";
  };
  for (const node of parent.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent ?? "").trim()) inline += escapeText(node.textContent ?? "");
      continue;
    }
    if (!(node instanceof Element)) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      flush();
      const items = [...node.children]
        .filter((child) => child.tagName.toLowerCase() === "li")
        .map((child) => `<li>${sanitize(child.innerHTML)}</li>`)
        .join("");
      if (items) out += `<${tagOpen(node, tag)}>${items}</${tag}>`;
      continue;
    }
    if (tag === "pre") {
      flush();
      out += `<pre class="tessera-pre">${escapeText(prePlainText(node))}</pre>`;
      continue;
    }
    if (tag === "p" || tag === "div") {
      const nested =
        tag === "div" &&
        [...node.children].some((child) => {
          const name = child.tagName.toLowerCase();
          return name === "p" || name === "div" || name === "ul" || name === "ol";
        });
      if (nested) {
        flush();
        out += blocksIn(node);
        continue;
      }
      flush();
      const inner = sanitize(node.innerHTML);
      if (!inner.replace(/<br>/gi, "").trim()) {
        const open = tag === "p" ? tagOpen(node, "p") : "p";
        out += `<${open}><br></p>`;
        continue;
      }
      const open = tag === "p" ? tagOpen(node, "p") : "p";
      out += `<${open}>${inner}</p>`;
      continue;
    }
    if (tag === "br") {
      inline += "<br>";
      continue;
    }
    inline += sanitize(node.outerHTML);
  }
  flush();
  return textBlocksHaveWords(out) ? out : "";
}

function textBlocksHaveWords(html: string): boolean {
  return html.replace(/<[^>]+>/g, "").replace(/\s/g, "") !== "";
}

function tagOpen(el: Element, tag: string): string {
  const className = el.getAttribute("class")?.trim() ?? "";
  return className ? `${tag} class="${escapeAttr(className)}"` : tag;
}

function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  return root ? cleanChildren(root) : "";
}

function prePlainText(el: Element): string {
  let out = "";
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      continue;
    }
    if (!(node instanceof Element)) continue;
    if (node.tagName.toLowerCase() === "br") {
      out += "\n";
      continue;
    }
    out += prePlainText(node);
  }
  return out;
}

function cleanChildren(parent: Element): string {
  let out = "";
  for (const node of parent.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += escapeText(node.textContent ?? "");
      continue;
    }
    if (!(node instanceof Element)) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === "div") {
      if (out && !out.endsWith("<br>")) out += "<br>";
      out += cleanChildren(node);
      continue;
    }
    if (tag === "pre") {
      out += `<pre class="tessera-pre">${escapeText(prePlainText(node))}</pre>`;
      continue;
    }
    if (tag === "strike") {
      out += `<s>${cleanChildren(node)}</s>`;
      continue;
    }
    if (!ALLOWED.has(tag)) {
      out += cleanChildren(node);
      continue;
    }
    if (tag === "br") {
      out += "<br>";
      continue;
    }
    if (tag === "a") {
      const pageId = node.getAttribute("data-tessera-page")?.trim() ?? "";
      if (pageId && /^[a-zA-Z0-9_-]+$/.test(pageId)) {
        out += `<a data-tessera-page="${escapeAttr(pageId)}" href="#">${cleanChildren(node)}</a>`;
        continue;
      }
      const href = node.getAttribute("href") ?? "";
      if (!/^(https?:|mailto:|\/|#|\.)/i.test(href) || /^\s*javascript:/i.test(href)) {
        out += cleanChildren(node);
        continue;
      }
      out += `<a href="${escapeAttr(href)}">${cleanChildren(node)}</a>`;
      continue;
    }
    out += `<${tag}>${cleanChildren(node)}</${tag}>`;
  }
  return out;
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}

