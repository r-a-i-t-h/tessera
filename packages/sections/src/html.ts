/** Small HTML fragment parser. Enough for zone bodies, with no DOM dependency. */

const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/** Opening one of these closes an unclosed `<p>`, as in HTML. */
const CLOSES_P = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "div",
  "dl",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
]);

export type Attr = { name: string; value: string };

export type TextNode = { type: "text"; text: string };

export type ElNode = {
  type: "el";
  tag: string;
  attrs: Attr[];
  children: HtmlNode[];
  /** Source slice from the opening `<` through the end of this element. */
  raw: string;
};

export type HtmlNode = TextNode | ElNode;

export function parseFragment(input: string): ElNode {
  const root: ElNode = { type: "el", tag: "#root", attrs: [], children: [], raw: "" };
  const stack: ElNode[] = [root];
  const starts: number[] = [0];
  let i = 0;

  const current = () => stack[stack.length - 1]!;

  const closeTop = (end: number) => {
    const el = stack.pop();
    const start = starts.pop();
    if (!el || el === root || start === undefined) return;
    el.raw = input.slice(start, end);
  };

  const closeUntil = (tag: string, end: number) => {
    for (let n = stack.length - 1; n > 0; n--) {
      if (stack[n]!.tag === tag) {
        while (stack.length - 1 >= n) closeTop(end);
        return;
      }
    }
  };

  const open = (el: ElNode, start: number) => {
    const parent = current();
    if (parent.tag === "p" && CLOSES_P.has(el.tag)) closeTop(start);
    if ((el.tag === "li" && parent.tag === "li") || ((el.tag === "td" || el.tag === "th") && (parent.tag === "td" || parent.tag === "th"))) {
      closeTop(start);
    }
    current().children.push(el);
    if (!VOID.has(el.tag)) {
      stack.push(el);
      starts.push(start);
    } else {
      el.raw = input.slice(start, i);
    }
  };

  while (i < input.length) {
    const lt = input.indexOf("<", i);
    if (lt === -1) {
      pushText(current(), input.slice(i));
      break;
    }
    if (lt > i) pushText(current(), input.slice(i, lt));
    if (input.startsWith("<!--", lt)) {
      const end = input.indexOf("-->", lt + 4);
      i = end === -1 ? input.length : end + 3;
      continue;
    }
    if (input.startsWith("</", lt)) {
      const tagEnd = input.indexOf(">", lt + 2);
      if (tagEnd === -1) break;
      const tag = input.slice(lt + 2, tagEnd).trim().split(/\s+/)[0]?.toLowerCase() ?? "";
      i = tagEnd + 1;
      if (tag) closeUntil(tag, i);
      continue;
    }
    if (input.startsWith("<!", lt) || input.startsWith("<?", lt)) {
      const tagEnd = input.indexOf(">", lt + 2);
      i = tagEnd === -1 ? input.length : tagEnd + 1;
      continue;
    }
    const parsed = readStartTag(input, lt);
    if (!parsed) {
      pushText(current(), "<");
      i = lt + 1;
      continue;
    }
    i = parsed.end;
    const el: ElNode = { type: "el", tag: parsed.tag, attrs: parsed.attrs, children: [], raw: "" };
    open(el, lt);
    if (parsed.selfClosing && !VOID.has(parsed.tag) && current() === el) closeTop(i);
  }

  while (stack.length > 1) closeTop(input.length);
  return root;
}

function pushText(parent: ElNode, text: string): void {
  if (!text) return;
  const decoded = decodeEntities(text);
  const last = parent.children[parent.children.length - 1];
  if (last && last.type === "text") last.text += decoded;
  else parent.children.push({ type: "text", text: decoded });
}

function readStartTag(
  input: string,
  start: number,
): { tag: string; attrs: Attr[]; end: number; selfClosing: boolean } | null {
  let i = start + 1;
  if (i >= input.length || !/[A-Za-z]/.test(input[i]!)) return null;
  const nameStart = i;
  while (i < input.length && /[A-Za-z0-9-]/.test(input[i]!)) i++;
  const tag = input.slice(nameStart, i).toLowerCase();
  const attrs: Attr[] = [];
  while (i < input.length) {
    while (i < input.length && /\s/.test(input[i]!)) i++;
    if (i >= input.length) break;
    if (input[i] === ">") return { tag, attrs, end: i + 1, selfClosing: false };
    if (input[i] === "/" && input[i + 1] === ">") return { tag, attrs, end: i + 2, selfClosing: true };
    if (!/[A-Za-z_:]/.test(input[i]!)) return null;
    const attrStart = i;
    while (i < input.length && /[^\s=/>]/.test(input[i]!)) i++;
    const name = input.slice(attrStart, i).toLowerCase();
    while (i < input.length && /\s/.test(input[i]!)) i++;
    if (input[i] !== "=") {
      attrs.push({ name, value: "" });
      continue;
    }
    i++;
    while (i < input.length && /\s/.test(input[i]!)) i++;
    let value = "";
    const quote = input[i];
    if (quote === `"` || quote === `'`) {
      i++;
      const valueStart = i;
      while (i < input.length && input[i] !== quote) i++;
      value = input.slice(valueStart, i);
      if (input[i] === quote) i++;
    } else {
      const valueStart = i;
      while (i < input.length && /[^\s>]/.test(input[i]!)) i++;
      value = input.slice(valueStart, i).replace(/\/$/, "");
    }
    attrs.push({ name, value: decodeEntities(value) });
  }
  return null;
}

export function classList(el: ElNode): string[] {
  const value = el.attrs.find((attr) => attr.name === "class")?.value ?? "";
  return value.split(/\s+/).filter(Boolean);
}

export function hasClass(el: ElNode, name: string): boolean {
  return classList(el).includes(name);
}

export function textContent(node: HtmlNode): string {
  if (node.type === "text") return node.text;
  return node.children.map((child) => textContent(child)).join("");
}

export function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}

export function serializeNode(node: HtmlNode): string {
  if (node.type === "text") return escapeText(node.text);
  const attrs = node.attrs
    .map((attr) => (attr.value === "" ? ` ${attr.name}` : ` ${attr.name}="${escapeAttr(attr.value)}"`))
    .join("");
  if (VOID.has(node.tag)) return `<${node.tag}${attrs}>`;
  return `<${node.tag}${attrs}>${node.children.map((child) => serializeNode(child)).join("")}</${node.tag}>`;
}

export function serializeChildren(nodes: HtmlNode[]): string {
  return nodes.map((node) => serializeNode(node)).join("");
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (entity, body: string) => {
    if (body === "amp") return "&";
    if (body === "lt") return "<";
    if (body === "gt") return ">";
    if (body === "quot") return `"`;
    if (body === "apos") return "'";
    if (body === "nbsp") return "\u00a0";
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }
    return entity;
  });
}
