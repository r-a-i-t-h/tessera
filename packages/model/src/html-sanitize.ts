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
    if (node.nodeType === Node.TEXT_NODE) {
      out += escapeText(node.textContent ?? "");
      continue;
    }
    if (!(node instanceof Element)) continue;
    const tag = node.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;
    if (tag === "br") {
      out += "<br>";
      continue;
    }
    if (tag === "img") {
      const src = node.getAttribute("src") ?? "";
      const alt = node.getAttribute("alt") ?? "";
      if (!src) continue;
      out += `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" />`;
      continue;
    }
    const inner = tag === "a" ? serializeChildren(node) : serializeChildren(node);
    const attrs =
      tag === "a"
        ? ` href="${escapeAttr(node.getAttribute("href") ?? "")}"`
        : "";
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
