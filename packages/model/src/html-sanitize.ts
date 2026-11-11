const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

const ALLOWED_TAGS = new Set([
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "code",
  "a",
  "br",
  "ul",
  "ol",
  "li",
  "p",
  "pre",
  "img",
]);

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function serializeChildren(root: Element): string {
  let out = "";
  for (const node of root.childNodes) {
    if (node.nodeType === TEXT_NODE) {
      out += escapeText(node.textContent ?? "");
      continue;
    }
    if (node.nodeType !== ELEMENT_NODE) continue;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;
    if (tag === "br") {
      out += "<br>";
      continue;
    }
    if (tag === "img") {
      const src = el.getAttribute("src") ?? "";
      const alt = el.getAttribute("alt") ?? "";
      if (!src) continue;
      out += `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" />`;
      continue;
    }
    let attrs = "";
    if (tag === "a") {
      const pageId = el.getAttribute("data-tessera-page")?.trim() ?? "";
      attrs = ` href="${escapeAttr(el.getAttribute("href") ?? "")}"`;
      if (pageId) attrs += ` data-tessera-page="${escapeAttr(pageId)}"`;
    } else if (tag === "pre" && el.getAttribute("class") === "tessera-pre") {
      attrs = ' class="tessera-pre"';
    }
    const inner = serializeChildren(el);
    out += `<${tag}${attrs}>${inner}</${tag}>`;
  }
  return out;
}

/** Whitelist sanitizer for dataset HTML fields and rich cell output. */
export function sanitizeRichHtml(html: string): string {
  if (!html.trim()) return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  return root ? serializeChildren(root) : "";
}

/** Decode entity-encoded markup once so the editor does not accumulate encoding. */
export function decodeHtmlEntitiesOnce(html: string): string {
  if (!html || html.includes("<")) return html;
  if (!/&(?:lt|gt|amp|quot|#)/i.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.documentElement.textContent ?? html;
}
