import {
  classList,
  escapeAttr,
  escapeText,
  hasClass,
  parseFragment,
  serializeChildren,
  textContent,
  type ElNode,
  type HtmlNode,
} from "./html.js";

export const TONES = [
  { id: "plain", label: "Plain", className: "" },
  { id: "sand", label: "Sand", className: "w3-sand" },
  { id: "pale", label: "Pale", className: "w3-pale-yellow" },
  { id: "pale-blue", label: "Pale blue", className: "w3-pale-blue" },
  { id: "pale-green", label: "Pale green", className: "w3-pale-green" },
  { id: "pale-red", label: "Pale red", className: "w3-pale-red" },
  { id: "theme", label: "Theme", className: "w3-theme-l4" },
  { id: "light-grey", label: "Light grey", className: "w3-light-grey" },
  { id: "white", label: "White", className: "w3-white" },
  { id: "orange", label: "Orange", className: "w3-orange" },
  { id: "teal", label: "Teal", className: "w3-teal" },
] as const;

export type ToneId = (typeof TONES)[number]["id"];

/** Tones offered when inserting a panel or quote. Parsed pages may still use the full list. */
export const PALETTE_TONES: ToneId[] = ["plain", "sand", "pale", "pale-blue", "theme"];

const TONE_CLASS = new Map<string, ToneId>([
  ["w3-sand", "sand"],
  ["w3-pale-yellow", "pale"],
  ["w3-pale-blue", "pale-blue"],
  ["w3-pale-green", "pale-green"],
  ["w3-pale-red", "pale-red"],
  ["w3-theme", "theme"],
  ["w3-theme-l1", "theme"],
  ["w3-theme-l2", "theme"],
  ["w3-theme-l3", "theme"],
  ["w3-theme-l4", "theme"],
  ["w3-theme-l5", "theme"],
  ["w3-theme-d1", "theme"],
  ["w3-light-grey", "light-grey"],
  ["w3-white", "white"],
  ["w3-orange", "orange"],
  ["w3-teal", "teal"],
]);

const PANEL_STRUCTURAL = new Set([
  "w3-panel",
  "w3-padding",
  "w3-padding-16",
  "w3-padding-32",
  "w3-margin",
  "w3-margin-top",
  "w3-margin-bottom",
  "w3-card",
  "w3-card-2",
  "w3-card-4",
  "w3-round",
  "w3-round-large",
  "w3-round-small",
  "w3-leftbar",
  "w3-rightbar",
  "w3-border",
  "w3-topbar",
  "w3-bottombar",
  "w3-center",
  "w3-left-align",
  "w3-right-align",
]);

const COLUMN_LAYOUT = new Set([
  "w3-half",
  "w3-third",
  "w3-twothird",
  "w3-quarter",
  "w3-threequarter",
  "w3-col",
  "w3-rest",
  "w3-cell",
]);

const COLUMN_CHROME = new Set([
  ...COLUMN_LAYOUT,
  "w3-container",
  "w3-mobile",
  "w3-row",
  "w3-padding",
  "w3-padding-16",
  "w3-section",
]);

export type ColumnCell = {
  className: string;
  sections: Section[];
};

export type GalleryMode = "grid" | "slides";

export type Section =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "text"; tag: "p" | "ul" | "ol"; html: string }
  | { kind: "panel"; tone: ToneId; html: string }
  | { kind: "quote"; tone: ToneId; text: string; attribution: string }
  | { kind: "imgbox"; src: string; alt: string; caption: string }
  | { kind: "card"; title: string; html: string }
  | { kind: "columns"; cells: ColumnCell[] }
  | { kind: "insert"; id: string }
  | { kind: "subpages"; title: string }
  | { kind: "youtube"; videoId: string; title: string }
  | { kind: "gallery"; folder: string; mode: GalleryMode }
  | { kind: "pasted"; html: string }
  | { kind: "html"; html: string };

export type PaletteKind =
  | "heading"
  | "text"
  | "panel"
  | "quote"
  | "imgbox"
  | "card"
  | "columns"
  | "insert"
  | "subpages"
  | "youtube"
  | "gallery"
  | "pasted";

export const PALETTE: { kind: PaletteKind; label: string }[] = [
  { kind: "heading", label: "Heading" },
  { kind: "text", label: "Text" },
  { kind: "panel", label: "Panel" },
  { kind: "quote", label: "Quote" },
  { kind: "imgbox", label: "Image box" },
  { kind: "card", label: "Card" },
  { kind: "columns", label: "Side by side" },
  { kind: "subpages", label: "Subpages" },
  { kind: "youtube", label: "YouTube" },
  { kind: "gallery", label: "Gallery" },
  { kind: "pasted", label: "Pasted note" },
  { kind: "insert", label: "Insert" },
];

const INSERT_ID = /^[A-Za-z0-9_-]+$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_ALLOW = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";

export function toneClass(tone: ToneId): string {
  return TONES.find((item) => item.id === tone)?.className ?? "";
}

export function toneLabel(tone: ToneId): string {
  return TONES.find((item) => item.id === tone)?.label ?? tone;
}

export function blankSection(kind: PaletteKind): Section {
  switch (kind) {
    case "heading":
      return { kind: "heading", level: 2, text: "" };
    case "text":
      return { kind: "text", tag: "p", html: "" };
    case "panel":
      return { kind: "panel", tone: "sand", html: "" };
    case "quote":
      return { kind: "quote", tone: "sand", text: "", attribution: "" };
    case "imgbox":
      return { kind: "imgbox", src: "", alt: "", caption: "" };
    case "card":
      return { kind: "card", title: "", html: "" };
    case "columns":
      return {
        kind: "columns",
        cells: [
          { className: "", sections: [] },
          { className: "", sections: [] },
        ],
      };
    case "insert":
      return { kind: "insert", id: "" };
    case "subpages":
      return { kind: "subpages", title: "" };
    case "youtube":
      return { kind: "youtube", videoId: "", title: "" };
    case "gallery":
      return { kind: "gallery", folder: "", mode: "grid" };
    case "pasted":
      return { kind: "pasted", html: "" };
  }
}

/** YouTube watch, share, embed, or shorts address, or an id on its own. */
export function youtubeVideoId(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  if (YOUTUBE_ID.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return YOUTUBE_ID.test(id) ? id : "";
    }
    if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "m.youtube.com") {
      const fromQuery = url.searchParams.get("v") ?? "";
      if (YOUTUBE_ID.test(fromQuery)) return fromQuery;
      const parts = url.pathname.split("/").filter(Boolean);
      const head = parts[0];
      const id = head === "embed" || head === "shorts" || head === "live" || head === "v" ? (parts[1] ?? "") : "";
      return YOUTUBE_ID.test(id) ? id : "";
    }
  } catch {
    return "";
  }
  return "";
}

export function paintSections(sections: Section[]): string {
  return sections.map((section) => paintSection(section)).filter(Boolean).join("\n");
}

export function paintSection(section: Section): string {
  switch (section.kind) {
    case "heading":
      return `<h${section.level}>${escapeText(section.text)}</h${section.level}>`;
    case "text":
      return `<${section.tag}>${section.html}</${section.tag}>`;
    case "panel": {
      const cls = joinClass("w3-panel", "w3-padding", toneClass(section.tone));
      return `<div class="${cls}">${section.html}</div>`;
    }
    case "quote":
      return paintQuote(section);
    case "imgbox":
      return paintImgbox(section);
    case "card":
      return `<div class="w3-card w3-padding w3-margin-bottom w3-white"><h3 class="w3-text-theme">${escapeText(section.title)}</h3><div class="rt-card-body">${section.html}</div></div>`;
    case "columns":
      return paintColumns(section.cells);
    case "insert":
      return INSERT_ID.test(section.id) ? `{{${section.id}}}` : "";
    case "subpages":
      return `<nav class="tessera-subpages w3-margin-bottom" data-tessera="subpages" data-title="${escapeAttr(section.title)}"></nav>`;
    case "youtube":
      return paintYoutube(section);
    case "gallery":
      return `<div class="tessera-page-gallery w3-margin-bottom" data-tessera="gallery" data-folder="${escapeAttr(section.folder)}" data-mode="${section.mode === "slides" ? "slides" : "grid"}"></div>`;
    case "pasted":
      return `<div class="tessera-pasted w3-margin-bottom"><div class="tessera-pasted-sheet">${section.html}</div></div>`;
    case "html":
      return section.html;
  }
}

export function parseSections(html: string): Section[] {
  const root = parseFragment(html);
  return walk(root.children, true);
}

function paintYoutube(section: Extract<Section, { kind: "youtube" }>): string {
  const id = youtubeVideoId(section.videoId);
  const src = id ? ` src="https://www.youtube-nocookie.com/embed/${escapeAttr(id)}"` : "";
  return `<div class="tessera-video w3-card w3-margin-bottom"><iframe${src} title="${escapeAttr(section.title)}" allow="${YOUTUBE_ALLOW}" allowfullscreen></iframe></div>`;
}

function paintQuote(section: Extract<Section, { kind: "quote" }>): string {
  const tone = toneClass(section.tone);
  const cls = joinClass("w3-panel", "w3-card-4", "w3-round-large", tone);
  const close = section.attribution
    ? `<p class="w3-right-align">${escapeText(section.attribution)}</p>`
    : `<p class="w3-right-align"><i class="fa fa-quote-right w3-xlarge w3-text-black w3-opacity-max"></i></p>`;
  return `<div class="w3-content w3-padding-16" style="max-width: 70%"><div class="${cls}"><p class="w3-left-align"><i class="fa fa-quote-left w3-xlarge w3-text-black w3-opacity-max"></i></p><p class="w3-xlarge w3-serif w3-center">${escapeText(section.text)}</p>${close}</div></div>`;
}

function paintImgbox(section: Extract<Section, { kind: "imgbox" }>): string {
  const caption = section.caption
    ? `<div class="w3-display-middle w3-container w3-padding-16 w3-display-hover w3-normal w3-round-large w3-opacity-min w3-white">${escapeText(section.caption)}</div>`
    : "";
  return `<div class="w3-display-container w3-container w3-padding-16 w3-card w3-center"><img src="${escapeAttr(section.src)}" class="w3-image" style="width: 100%" alt="${escapeAttr(section.alt)}">${caption}</div>`;
}

function paintColumns(cells: ColumnCell[]): string {
  const layout = cells.length === 3 ? "w3-third" : cells.length === 4 ? "w3-quarter" : "w3-half";
  const inner = cells
    .map((cell) => `<div class="${joinClass(layout, cell.className)}">${paintSections(cell.sections)}</div>`)
    .join("");
  return `<div class="w3-row-padding w3-stretch">${inner}</div>`;
}

function walk(nodes: HtmlNode[], allowColumns: boolean): Section[] {
  const sections: Section[] = [];
  for (const node of nodes) {
    if (node.type === "text") {
      splitText(sections, node.text);
      continue;
    }
    sections.push(...classify(node, allowColumns));
  }
  return sections;
}

function splitText(sections: Section[], text: string): void {
  const re = /\{\{([A-Za-z0-9_-]+)\}\}/g;
  let last = 0;
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    const before = text.slice(last, index).trim();
    if (before) sections.push({ kind: "text", tag: "p", html: escapeText(before) });
    sections.push({ kind: "insert", id: match[1]! });
    last = index + match[0].length;
  }
  const after = text.slice(last).trim();
  if (after) sections.push({ kind: "text", tag: "p", html: escapeText(after) });
}

function classify(el: ElNode, allowColumns: boolean): Section[] {
  const pageElement = asPageElement(el);
  if (pageElement) return [pageElement];
  if (isBareDiv(el)) return walk(el.children, allowColumns);
  if (allowColumns) {
    const columns = asColumns(el);
    if (columns) return [columns];
  }
  const imgbox = asImgbox(el);
  if (imgbox) return [imgbox];
  const quote = asQuote(el);
  if (quote) return [quote];
  const panel = asPanel(el);
  if (panel) return [panel];
  const card = asCard(el);
  if (card) return [card];
  if (el.tag === "h1" || el.tag === "h2" || el.tag === "h3") {
    return [{ kind: "heading", level: Number(el.tag[1]) as 1 | 2 | 3, text: textContent(el).trim() }];
  }
  if (el.tag === "p" || el.tag === "ul" || el.tag === "ol") {
    const only = onlyInsert(el);
    if (only) return only;
    return [{ kind: "text", tag: el.tag, html: serializeChildren(el.children) }];
  }
  if (!el.raw.trim()) return [];
  return [{ kind: "html", html: el.raw }];
}

function asPageElement(el: ElNode): Section | null {
  const marker = attr(el, "data-tessera");
  if (marker === "subpages" || (el.tag === "nav" && hasClass(el, "tessera-subpages"))) {
    return { kind: "subpages", title: attr(el, "data-title") };
  }
  if (marker === "gallery" || hasClass(el, "tessera-page-gallery")) {
    return {
      kind: "gallery",
      folder: attr(el, "data-folder"),
      mode: attr(el, "data-mode") === "slides" ? "slides" : "grid",
    };
  }
  if (hasClass(el, "tessera-video")) {
    const frame = findEl(el, (node) => node.tag === "iframe");
    return {
      kind: "youtube",
      videoId: frame ? youtubeVideoId(attr(frame, "src")) : "",
      title: frame ? attr(frame, "title") : "",
    };
  }
  if (hasClass(el, "tessera-pasted")) {
    const sheet = findEl(el, (node) => hasClass(node, "tessera-pasted-sheet"));
    return { kind: "pasted", html: serializeChildren((sheet ?? el).children) };
  }
  return null;
}

function isBareDiv(el: ElNode): boolean {
  return el.tag === "div" && classList(el).length === 0 && !el.attrs.some((attr) => attr.name === "id" || attr.name === "style");
}

function asColumns(el: ElNode): Section | null {
  const tokens = classList(el);
  const row = tokens.includes("w3-row-padding") || tokens.includes("w3-cell-row") || tokens.includes("w3-row");
  if (!row) return null;
  const divs = el.children.filter((child): child is ElNode => child.type === "el" && child.tag === "div");
  const marked = divs.filter((child) => classList(child).some((name) => COLUMN_LAYOUT.has(name)));
  const cells = marked.length >= 2 ? marked : divs.length >= 2 && (tokens.includes("w3-row-padding") || tokens.includes("w3-cell-row")) ? divs : [];
  if (cells.length < 2) return null;
  return {
    kind: "columns",
    cells: cells.map((cell) => ({
      className: classList(cell)
        .filter((name) => !COLUMN_CHROME.has(name))
        .join(" "),
      sections: walk(cell.children, false),
    })),
  };
}

function asImgbox(el: ElNode): Section | null {
  if (!hasClass(el, "w3-display-container")) return null;
  const img = findEl(el, (node) => node.tag === "img");
  if (!img) return null;
  const captionEl = findEl(el, (node) => hasClass(node, "w3-display-middle") && textContent(node).trim() !== "");
  return {
    kind: "imgbox",
    src: attr(img, "src"),
    alt: attr(img, "alt"),
    caption: captionEl ? textContent(captionEl).trim() : "",
  };
}

function asQuote(el: ElNode): Section | null {
  if (el.tag !== "blockquote" && !hasIcon(el, "fa-quote-left") && !hasIcon(el, "fa-quote-right")) return null;
  const panel = findEl(el, (node) => hasClass(node, "w3-panel")) ?? el;
  let text = "";
  let attribution = "";
  for (const para of collect(el, (node) => node.tag === "p")) {
    const words = textContent(para).trim();
    if (hasIcon(para, "fa-quote-left")) continue;
    if (hasIcon(para, "fa-quote-right")) continue;
    if (hasClass(para, "w3-right-align")) {
      attribution = words;
      continue;
    }
    if (!text && words) text = words;
  }
  if (el.tag === "blockquote" && !text) text = textContent(el).trim();
  return { kind: "quote", tone: toneOf(panel), text, attribution };
}

function asPanel(el: ElNode): Section | null {
  if (!hasClass(el, "w3-panel")) return null;
  if (!classesArePanel(el)) return null;
  return { kind: "panel", tone: toneOf(el), html: serializeChildren(el.children) };
}

function asCard(el: ElNode): Section | null {
  if (!hasClass(el, "w3-card") || hasClass(el, "w3-panel") || hasClass(el, "w3-display-container")) return null;
  const titleEl = findEl(el, (node) => node.tag === "h3");
  const body = findEl(el, (node) => hasClass(node, "rt-card-body"));
  const html = body
    ? serializeChildren(body.children)
    : serializeChildren(el.children.filter((child) => !(child.type === "el" && child.tag === "h3")));
  return { kind: "card", title: titleEl ? textContent(titleEl).trim() : "", html };
}

function classesArePanel(el: ElNode): boolean {
  return classList(el).every((name) => PANEL_STRUCTURAL.has(name) || TONE_CLASS.has(name) || !name.startsWith("w3-"));
}

function toneOf(el: ElNode): ToneId {
  for (const name of classList(el)) {
    const tone = TONE_CLASS.get(name);
    if (tone) return tone;
  }
  return "plain";
}

function onlyInsert(el: ElNode): Section[] | null {
  const text = textContent(el).trim();
  const match = text.match(/^\{\{([A-Za-z0-9_-]+)\}\}$/);
  if (!match) return null;
  return [{ kind: "insert", id: match[1]! }];
}

function hasIcon(el: ElNode, name: string): boolean {
  return findEl(el, (node) => classList(node).includes(name)) !== null || classList(el).includes(name);
}

function findEl(el: ElNode, pred: (node: ElNode) => boolean): ElNode | null {
  if (pred(el)) return el;
  for (const child of el.children) {
    if (child.type !== "el") continue;
    const found = findEl(child, pred);
    if (found) return found;
  }
  return null;
}

function collect(el: ElNode, pred: (node: ElNode) => boolean): ElNode[] {
  const found: ElNode[] = [];
  const visit = (node: ElNode) => {
    if (pred(node)) found.push(node);
    for (const child of node.children) {
      if (child.type === "el") visit(child);
    }
  };
  visit(el);
  return found;
}

function attr(el: ElNode, name: string): string {
  return el.attrs.find((item) => item.name === name)?.value ?? "";
}

function joinClass(...parts: string[]): string {
  return parts
    .flatMap((part) => part.split(/\s+/))
    .filter(Boolean)
    .join(" ");
}
