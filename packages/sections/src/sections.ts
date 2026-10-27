import {
  classList,
  escapeAttr,
  escapeText,
  hasClass,
  htmlToPlainText,
  parseFragment,
  plainTextToHtml,
  renderMarkdownLinks,
  serializeChildren,
  serializeNode,
  textContent,
  type ElNode,
  type HtmlNode,
} from "./html.js";

export type PanelToneDef = { id: string; label: string; className: string };

export const TONES: readonly PanelToneDef[] = [
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
];

/** Any built-in, site-catalog, or opaque (class-as-id) tone. */
export type ToneId = string;

/** Tones offered when inserting a panel or quote. Parsed pages may still use the full list. */
export const PALETTE_TONES: ToneId[] = ["plain", "sand", "pale", "pale-blue", "theme"];

/** Class token usable as an opaque tone id when the catalog is missing. */
const TONE_CLASS_ID = /^[a-z][a-z0-9-]*$/;

const CORE_TONE_CLASS = new Map<string, ToneId>([
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

type ToneLookup = {
  byId: Map<string, PanelToneDef>;
  byClass: Map<string, ToneId>;
};

function buildToneLookup(extras?: readonly PanelToneDef[]): ToneLookup {
  const byId = new Map<string, PanelToneDef>();
  const byClass = new Map<string, ToneId>(CORE_TONE_CLASS);
  for (const tone of TONES) {
    byId.set(tone.id, tone);
    if (tone.className) byClass.set(tone.className, tone.id);
  }
  for (const tone of extras ?? []) {
    byId.set(tone.id, tone);
    if (tone.className) byClass.set(tone.className, tone.id);
  }
  return { byId, byClass };
}

const EMPTY_LOOKUP = buildToneLookup();

/** Vertical rhythm between composed blocks on a page. */
export const BLOCK_CLASS = "tessera-block";

const PANEL_STRUCTURAL = new Set([
  BLOCK_CLASS,
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

/** Side-by-side ratios, using the W3 column classes. */
export const COLUMN_LAYOUTS = [
  { id: "1:1", label: "2 columns 1:1", widths: ["w3-half", "w3-half"] },
  { id: "2:1", label: "2 columns 2:1", widths: ["w3-twothird", "w3-third"] },
  { id: "1:2", label: "2 columns 1:2", widths: ["w3-third", "w3-twothird"] },
  { id: "1:1:1", label: "3 columns 1:1:1", widths: ["w3-third", "w3-third", "w3-third"] },
  { id: "1:2:1", label: "3 columns 1:2:1", widths: ["w3-quarter", "w3-half", "w3-quarter"] },
  { id: "1:1:1:1", label: "4 columns 1:1:1:1", widths: ["w3-quarter", "w3-quarter", "w3-quarter", "w3-quarter"] },
] as const;

export type ColumnLayoutId = (typeof COLUMN_LAYOUTS)[number]["id"];

/** Proportional width of a Card or ImgBox relative to its containing block. */
export const BLOCK_WIDTHS = [
  { id: "full", label: "Full width" },
  { id: "threequarter", label: "Three quarters" },
  { id: "twothird", label: "Two thirds" },
  { id: "half", label: "Half" },
  { id: "third", label: "One third" },
] as const;

export type BlockWidthId = (typeof BLOCK_WIDTHS)[number]["id"];

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

export type HeadingLevel = 1 | 2 | 3 | 4;

export function parseHeadingLevel(value: string | number): HeadingLevel {
  const level = typeof value === "number" ? value : Number(value);
  if (level === 1 || level === 2 || level === 3 || level === 4) return level;
  return 2;
}

function isHeadingTag(tag: string): tag is `h${HeadingLevel}` {
  return tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4";
}

export type Section =
  | { kind: "heading"; level: HeadingLevel; text: string }
  | { kind: "text"; heading: string; level: HeadingLevel; html: string; loose?: boolean }
  | { kind: "panel"; tone: ToneId; sections: Section[] }
  | { kind: "quote"; tone: ToneId; text: string; attribution: string }
  | { kind: "imgbox"; src: string; alt: string; caption: string; plain: boolean; width: BlockWidthId }
  | { kind: "card"; title: string; width: BlockWidthId; plain: boolean; sections: Section[] }
  | { kind: "columns"; layout: ColumnLayoutId; cells: ColumnCell[] }
  | { kind: "insert"; id: string }
  | { kind: "subpages"; title: string; tone?: ToneId }
  | { kind: "toc" }
  | { kind: "youtube"; videoId: string; /** iframe `title` for accessibility */ title: string }
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
  | "toc"
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
  { kind: "toc", label: "Contents" },
  { kind: "youtube", label: "YouTube" },
  { kind: "gallery", label: "Gallery" },
  { kind: "pasted", label: "Pasted note" },
  { kind: "insert", label: "Insert" },
];

const INSERT_ID = /^[A-Za-z0-9_-]+$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_ALLOW = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";

export function toneClass(tone: ToneId, extras?: readonly PanelToneDef[]): string {
  const known = buildToneLookup(extras).byId.get(tone);
  if (known) return known.className;
  // Opaque: keep the class painted into content when the catalog is absent.
  return TONE_CLASS_ID.test(tone) ? tone : "";
}

export function toneLabel(tone: ToneId, extras?: readonly PanelToneDef[]): string {
  return buildToneLookup(extras).byId.get(tone)?.label ?? tone;
}

/** Built-in palette ids plus site tones, keeping an unknown current id on the list. */
export function paletteToneIds(extras?: readonly PanelToneDef[], current?: string): ToneId[] {
  const ids = [...PALETTE_TONES, ...(extras ?? []).map((tone) => tone.id)];
  if (current && !ids.includes(current)) ids.push(current);
  return ids;
}

function resolveToneClass(tone: ToneId, lookup: ToneLookup): string {
  const known = lookup.byId.get(tone);
  if (known) return known.className;
  return TONE_CLASS_ID.test(tone) ? tone : "";
}

export function isColumnLayout(value: string): value is ColumnLayoutId {
  return COLUMN_LAYOUTS.some((item) => item.id === value);
}

export function isBlockWidth(value: string): value is BlockWidthId {
  return BLOCK_WIDTHS.some((item) => item.id === value);
}

export function columnWidths(layout: ColumnLayoutId): readonly string[] {
  return COLUMN_LAYOUTS.find((item) => item.id === layout)?.widths ?? COLUMN_LAYOUTS[0].widths;
}

function widthAttr(width: BlockWidthId): string {
  return width === "full" ? "" : ` data-width="${width}"`;
}

function parseBlockWidth(el: ElNode): BlockWidthId {
  const raw = attr(el, "data-width");
  return isBlockWidth(raw) ? raw : "full";
}

/** Image box frame. `plain` drops the card chrome and padding so width applies to the raw image. */
export function imgboxClass(plain: boolean): string {
  return joinClass(
    BLOCK_CLASS,
    "tessera-imgbox",
    "w3-display-container",
    plain ? "" : "w3-container",
    plain ? "" : "w3-padding-16",
    plain ? "" : "w3-card",
    "w3-center",
  );
}

/** Card shell. `plain` drops chrome and padding so width applies to the raw body. */
export function cardClass(plain: boolean): string {
  return joinClass(BLOCK_CLASS, "tessera-card", plain ? "" : "w3-card", plain ? "" : "w3-padding", plain ? "" : "w3-white");
}

export function blankSection(kind: PaletteKind): Section {
  switch (kind) {
    case "heading":
      return { kind: "heading", level: 2, text: "" };
    case "text":
      return { kind: "text", heading: "", level: 2, html: "" };
    case "panel":
      return { kind: "panel", tone: "sand", sections: [] };
    case "quote":
      return { kind: "quote", tone: "sand", text: "", attribution: "" };
    case "imgbox":
      return { kind: "imgbox", src: "", alt: "", caption: "", plain: false, width: "twothird" };
    case "card":
      return { kind: "card", title: "", width: "full", plain: false, sections: [] };
    case "columns":
      return {
        kind: "columns",
        layout: "1:1",
        cells: [
          { className: "", sections: [] },
          { className: "", sections: [] },
        ],
      };
    case "insert":
      return { kind: "insert", id: "" };
    case "subpages":
      return { kind: "subpages", title: "" };
    case "toc":
      return { kind: "toc" };
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

export function paintSections(sections: Section[], tones?: readonly PanelToneDef[]): string {
  const lookup = buildToneLookup(tones);
  return sections.map((section) => paintSection(section, lookup)).filter(Boolean).join("\n");
}

export function paintSection(section: Section, lookup: ToneLookup = EMPTY_LOOKUP): string {
  switch (section.kind) {
    case "heading":
      return `<h${section.level} class="${BLOCK_CLASS}">${escapeText(section.text)}</h${section.level}>`;
    case "text":
      return paintText(section);
    case "panel":
      return paintPanel(section, lookup);
    case "quote":
      return paintQuote(section, lookup);
    case "imgbox":
      return paintImgbox(section);
    case "card":
      return paintCard(section, lookup);
    case "columns":
      return paintColumns(section, lookup);
    case "insert":
      return INSERT_ID.test(section.id) ? `{{${section.id}}}` : "";
    case "subpages": {
      const tone = section.tone && section.tone !== "plain" ? section.tone : undefined;
      const toneAttr = tone ? ` data-tone="${escapeAttr(tone)}"` : "";
      return `<nav class="${joinClass(BLOCK_CLASS, "tessera-subpages", tone ? resolveToneClass(tone, lookup) : "")}" data-tessera="subpages" data-title="${escapeAttr(section.title)}"${toneAttr}></nav>`;
    }
    case "toc":
      return `<nav class="${joinClass(BLOCK_CLASS, "tessera-toc")}" data-tessera="toc"></nav>`;
    case "youtube":
      return paintYoutube(section);
    case "gallery":
      return `<div class="${joinClass(BLOCK_CLASS, "tessera-page-gallery")}" data-tessera="gallery" data-folder="${escapeAttr(section.folder)}" data-mode="${section.mode === "slides" ? "slides" : "grid"}"></div>`;
    case "pasted":
      return `<div class="${joinClass(BLOCK_CLASS, "tessera-pasted")}"><div class="tessera-pasted-sheet">${renderMarkdownLinks(section.html)}</div></div>`;
    case "html":
      return renderMarkdownLinks(section.html);
  }
}

export function parseSections(html: string, tones?: readonly PanelToneDef[]): Section[] {
  const lookup = buildToneLookup(tones);
  const root = parseFragment(html);
  return walk(root.children, true, lookup);
}

function isBlankTextHtml(html: string): boolean {
  const compact = html.replace(/\s/g, "").toLowerCase();
  if (!compact) return true;
  return compact === "<p></p>" || compact === "<p><br></p>" || compact === "<p><br/></p>";
}

function textSectionHasContent(section: { heading: string; html: string }): boolean {
  return section.heading.trim() !== "" || !isBlankTextHtml(section.html);
}

function paintText(section: Extract<Section, { kind: "text" }>): string {
  if (!textSectionHasContent(section)) return "";
  const heading = section.heading.trim();
  const title = heading ? `<h${section.level}>${escapeText(heading)}</h${section.level}>` : "";
  return `<div class="${joinClass(BLOCK_CLASS, "tessera-text", section.loose ? "tessera-loose" : "")}">${title}${renderMarkdownLinks(section.html)}</div>`;
}

function paintYoutube(section: Extract<Section, { kind: "youtube" }>): string {
  const id = youtubeVideoId(section.videoId);
  if (!id) return "";
  return `<div class="${joinClass(BLOCK_CLASS, "tessera-youtube")}"><div class="tessera-video"><iframe src="https://www.youtube-nocookie.com/embed/${escapeAttr(id)}" title="${escapeAttr(section.title)}" allow="${YOUTUBE_ALLOW}" allowfullscreen></iframe></div></div>`;
}

export type QuoteBlockOptions = {
  textAttributes?: string;
  attributionAttributes?: string;
};

function quoteMark(role: "open" | "close"): string {
  const ch = role === "open" ? "\u201C" : "\u201D";
  return `<span class="tessera-quote-mark tessera-quote-${role}" aria-hidden="true">${ch}</span>`;
}

function quoteInnerHtml(text: string, attribution: string, options: QuoteBlockOptions = {}): string {
  const textAttrs = options.textAttributes ? ` ${options.textAttributes}` : "";
  const byAttrs = options.attributionAttributes ? ` ${options.attributionAttributes}` : "";
  const by = attribution ? `<p class="w3-right-align"${byAttrs}>${escapeText(attribution)}</p>` : "";
  return `${quoteMark("open")}<p class="w3-xlarge w3-serif w3-center"${textAttrs}>${plainTextToHtml(text)}</p>${by}${quoteMark("close")}`;
}

export function quoteBlockHtml(
  text: string,
  attribution: string,
  tone: ToneId,
  options: QuoteBlockOptions = {},
  extras?: readonly PanelToneDef[],
): string {
  const cls = joinClass(
    "w3-panel",
    "w3-card-4",
    "w3-round-large",
    "tessera-quote",
    toneClass(tone, extras),
  );
  return `<div class="${joinClass(BLOCK_CLASS, "w3-content", "w3-padding-16")}" style="max-width: 70%"><div class="${cls}">${quoteInnerHtml(text, attribution, options)}</div></div>`;
}

function paintQuote(section: Extract<Section, { kind: "quote" }>, lookup: ToneLookup): string {
  const cls = joinClass(
    "w3-panel",
    "w3-card-4",
    "w3-round-large",
    "tessera-quote",
    resolveToneClass(section.tone, lookup),
  );
  return `<div class="${joinClass(BLOCK_CLASS, "w3-content", "w3-padding-16")}" style="max-width: 70%"><div class="${cls}">${quoteInnerHtml(section.text, section.attribution)}</div></div>`;
}

function paintImgbox(section: Extract<Section, { kind: "imgbox" }>): string {
  const caption = section.caption
    ? `<div class="w3-display-middle w3-container w3-padding-16 w3-display-hover w3-normal w3-round-large w3-opacity-min w3-white">${escapeText(section.caption)}</div>`
    : "";
  return `<div class="${imgboxClass(section.plain)}"${widthAttr(section.width)}><img src="${escapeAttr(section.src)}" class="w3-image" alt="${escapeAttr(section.alt)}">${caption}</div>`;
}

function paintPanel(section: Extract<Section, { kind: "panel" }>, lookup: ToneLookup): string {
  const body = section.sections.map((item) => paintSection(item, lookup)).filter(Boolean).join("\n").trim();
  if (!body) return "";
  const cls = joinClass(BLOCK_CLASS, "w3-panel", "w3-padding", resolveToneClass(section.tone, lookup));
  return `<div class="${cls}"><div class="rt-panel-body">${body}</div></div>`;
}

function paintCard(section: Extract<Section, { kind: "card" }>, lookup: ToneLookup): string {
  const title = section.title.trim();
  const titleHtml = title ? `<h3 class="w3-text-theme">${escapeText(title)}</h3>` : "";
  const body = section.sections.map((item) => paintSection(item, lookup)).filter(Boolean).join("\n").trim();
  if (!titleHtml && !body) return "";
  const bodyHtml = body ? `<div class="rt-card-body">${body}</div>` : "";
  return `<div class="${cardClass(section.plain)}"${widthAttr(section.width)}>${titleHtml}${bodyHtml}</div>`;
}

function paintColumns(section: Extract<Section, { kind: "columns" }>, lookup: ToneLookup): string {
  const widths = columnWidths(section.layout);
  const inner = section.cells
    .map(
      (cell, index) =>
        `<div class="${joinClass(widths[index] ?? "", cell.className)}">${cell.sections
          .map((item) => paintSection(item, lookup))
          .filter(Boolean)
          .join("\n")}</div>`,
    )
    .join("");
  return `<div class="${joinClass(BLOCK_CLASS, "w3-row-padding", "w3-stretch")}">${inner}</div>`;
}

type Atom =
  | { type: "flow"; html: string }
  | { type: "heading"; level: HeadingLevel; text: string }
  | { type: "section"; section: Section };

function walk(nodes: HtmlNode[], allowColumns: boolean, lookup: ToneLookup): Section[] {
  return groupAtoms(nodes.flatMap((node) => atomsFrom(node, allowColumns, lookup)));
}

/** A heading followed by paragraphs or lists is one text run. A heading before anything else stays a heading. */
function groupAtoms(atoms: Atom[]): Section[] {
  const sections: Section[] = [];
  let i = 0;
  while (i < atoms.length) {
    const atom = atoms[i]!;
    if (atom.type === "section") {
      sections.push(atom.section);
      i += 1;
      continue;
    }
    let heading = "";
    let level: HeadingLevel = 2;
    if (atom.type === "heading") {
      if (atoms[i + 1]?.type !== "flow") {
        sections.push({ kind: "heading", level: atom.level, text: atom.text });
        i += 1;
        continue;
      }
      heading = atom.text;
      level = atom.level;
      i += 1;
    }
    let html = "";
    while (i < atoms.length && atoms[i]?.type === "flow") {
      html += (atoms[i] as { type: "flow"; html: string }).html;
      i += 1;
    }
    if (textSectionHasContent({ heading, html })) {
      sections.push({ kind: "text", heading, level, html });
    }
  }
  return sections;
}

function atomsFrom(node: HtmlNode, allowColumns: boolean, lookup: ToneLookup): Atom[] {
  if (node.type === "text") {
    if (!node.text.trim()) return [];
    return splitTextAtoms(node.text);
  }
  const textRun = asTextRun(node);
  if (textRun) return [{ type: "section", section: textRun }];
  if (hasClass(node, "tessera-text")) return [];
  if (isBareDiv(node)) return node.children.flatMap((child) => atomsFrom(child, allowColumns, lookup));
  if (node.tag === "p" || node.tag === "ul" || node.tag === "ol" || node.tag === "pre") {
    const insert = onlyInsert(node);
    if (insert) return [{ type: "section", section: insert }];
    return [{ type: "flow", html: serializeNode(node) }];
  }
  if (isHeadingTag(node.tag)) {
    return [{ type: "heading", level: parseHeadingLevel(node.tag[1]!), text: textContent(node).trim() }];
  }
  return classify(node, allowColumns, lookup).map((section) => ({ type: "section", section }));
}

function splitTextAtoms(text: string): Atom[] {
  const atoms: Atom[] = [];
  const re = /\{\{([A-Za-z0-9_-]+)\}\}/g;
  let last = 0;
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    const before = text.slice(last, index).trim();
    if (before) atoms.push({ type: "flow", html: `<p>${escapeText(before)}</p>` });
    atoms.push({ type: "section", section: { kind: "insert", id: match[1]! } });
    last = index + match[0].length;
  }
  const after = text.slice(last).trim();
  if (after) atoms.push({ type: "flow", html: `<p>${escapeText(after)}</p>` });
  return atoms;
}

function asTextRun(el: ElNode): Section | null {
  if (!hasClass(el, "tessera-text")) return null;
  const children = el.children.filter((child) => child.type !== "text" || child.text.trim());
  let heading = "";
  let level: HeadingLevel = 2;
  let start = 0;
  const first = children[0];
  if (first?.type === "el" && isHeadingTag(first.tag)) {
    heading = textContent(first).trim();
    level = parseHeadingLevel(first.tag[1]!);
    start = 1;
  }
  const html = serializeChildren(children.slice(start));
  const loose = hasClass(el, "tessera-loose");
  const section = {
    kind: "text" as const,
    heading,
    level,
    html,
    ...(loose ? { loose: true } : {}),
  };
  return textSectionHasContent(section) ? section : null;
}

function classify(el: ElNode, allowColumns: boolean, lookup: ToneLookup): Section[] {
  const pageElement = asPageElement(el, lookup);
  if (pageElement) return [pageElement];
  if (isBareDiv(el)) return walk(el.children, allowColumns, lookup);
  if (allowColumns) {
    const columns = asColumns(el, lookup);
    if (columns) return [columns];
  }
  const imgbox = asImgbox(el);
  if (imgbox) return [imgbox];
  const quote = asQuote(el, lookup);
  if (quote) return [quote];
  const panel = asPanel(el, lookup);
  if (panel) return [panel];
  const card = asCard(el, lookup);
  if (card) return [card];
  if (!el.raw.trim()) return [];
  return [{ kind: "html", html: el.raw }];
}

function asPageElement(el: ElNode, lookup: ToneLookup): Section | null {
  const marker = attr(el, "data-tessera");
  if (marker === "subpages" || (el.tag === "nav" && hasClass(el, "tessera-subpages"))) {
    const dataTone = attr(el, "data-tone");
    let tone: ToneId = "plain";
    if (dataTone) tone = dataTone;
    else {
      for (const name of classList(el)) {
        const mapped = lookup.byClass.get(name);
        if (mapped) {
          tone = mapped;
          break;
        }
      }
      if (tone === "plain") {
        for (const name of classList(el)) {
          if (name === "tessera-subpages" || name === BLOCK_CLASS) continue;
          if (!PANEL_STRUCTURAL.has(name) && TONE_CLASS_ID.test(name)) {
            tone = name;
            break;
          }
        }
      }
    }
    return {
      kind: "subpages",
      title: attr(el, "data-title"),
      ...(tone !== "plain" ? { tone } : {}),
    };
  }
  if (marker === "toc" || (el.tag === "nav" && hasClass(el, "tessera-toc"))) {
    return { kind: "toc" };
  }
  if (marker === "gallery" || hasClass(el, "tessera-page-gallery")) {
    return {
      kind: "gallery",
      folder: attr(el, "data-folder"),
      mode: attr(el, "data-mode") === "slides" ? "slides" : "grid",
    };
  }
  if (hasClass(el, "tessera-youtube")) {
    return parseYoutubeBlock(el);
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

function asColumns(el: ElNode, lookup: ToneLookup): Section | null {
  const tokens = classList(el);
  const row = tokens.includes("w3-row-padding") || tokens.includes("w3-cell-row") || tokens.includes("w3-row");
  if (!row) return null;
  const divs = el.children.filter((child): child is ElNode => child.type === "el" && child.tag === "div");
  const marked = divs.filter((child) => classList(child).some((name) => COLUMN_LAYOUT.has(name)));
  const cells = marked.length >= 2 ? marked : divs.length >= 2 && (tokens.includes("w3-row-padding") || tokens.includes("w3-cell-row")) ? divs : [];
  if (cells.length < 2) return null;
  return {
    kind: "columns",
    layout: layoutOf(cells),
    cells: cells.map((cell) => ({
      className: classList(cell)
        .filter((name) => !COLUMN_CHROME.has(name))
        .join(" "),
      sections: walk(cell.children, false, lookup),
    })),
  };
}

function layoutOf(cells: ElNode[]): ColumnLayoutId {
  const widths = cells.map((cell) => classList(cell).find((name) => name !== "w3-col" && name !== "w3-rest" && name !== "w3-cell" && COLUMN_LAYOUT.has(name)) ?? "");
  const found = COLUMN_LAYOUTS.find((item) => item.widths.length === widths.length && item.widths.every((width, index) => widths[index] === width));
  if (found) return found.id;
  if (cells.length >= 4) return "1:1:1:1";
  if (cells.length === 3) return "1:1:1";
  return "1:1";
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
    plain: !hasClass(el, "w3-card"),
    width: parseBlockWidth(el),
  };
}

function isQuoteDecoration(para: ElNode): boolean {
  if (hasIcon(para, "fa-quote-left") || hasIcon(para, "fa-quote-right")) return true;
  return findEl(para, (node) => hasClass(node, "tessera-quote-mark")) !== null;
}

function asQuote(el: ElNode, lookup: ToneLookup): Section | null {
  const panel = findEl(el, (node) => hasClass(node, "w3-panel")) ?? el;
  const marked = hasClass(panel, "tessera-quote");
  if (el.tag !== "blockquote" && !marked && !hasIcon(el, "fa-quote-left") && !hasIcon(el, "fa-quote-right")) return null;
  let text = "";
  let attribution = "";
  for (const para of collect(el, (node) => node.tag === "p")) {
    if (isQuoteDecoration(para)) continue;
    if (hasClass(para, "w3-right-align")) {
      attribution = textContent(para).trim();
      continue;
    }
    if (!text) {
      const words = htmlToPlainText(serializeChildren(para.children));
      if (words) text = words;
    }
  }
  if (el.tag === "blockquote" && !text) text = htmlToPlainText(serializeChildren(el.children));
  return { kind: "quote", tone: toneOf(panel, lookup), text, attribution };
}

function asPanel(el: ElNode, lookup: ToneLookup): Section | null {
  if (!hasClass(el, "w3-panel")) return null;
  if (!classesArePanel(el, lookup)) return null;
  const body = directChild(el, (node) => hasClass(node, "rt-panel-body"));
  const nodes = body ? body.children : el.children;
  return { kind: "panel", tone: toneOf(el, lookup), sections: walk(nodes, true, lookup) };
}

function parseYoutubeBlock(el: ElNode): Section {
  const frame = findEl(el, (node) => node.tag === "iframe");
  return {
    kind: "youtube",
    videoId: frame ? youtubeVideoId(attr(frame, "src")) : "",
    title: frame ? attr(frame, "title") : "",
  };
}

function asCard(el: ElNode, lookup: ToneLookup): Section | null {
  const marked = hasClass(el, "tessera-card");
  const chrome = hasClass(el, "w3-card");
  if (!marked && !chrome) return null;
  if (
    hasClass(el, "w3-panel") ||
    hasClass(el, "w3-display-container") ||
    hasClass(el, "tessera-imgbox") ||
    hasClass(el, "tessera-video") ||
    hasClass(el, "tessera-youtube")
  )
    return null;
  const titleEl = directChild(el, (node) => node.tag === "h3");
  const body = directChild(el, (node) => hasClass(node, "rt-card-body"));
  const nodes = body ? body.children : el.children.filter((child) => !(child.type === "el" && child.tag === "h3"));
  return {
    kind: "card",
    title: titleEl ? textContent(titleEl).trim() : "",
    width: parseBlockWidth(el),
    plain: marked ? !chrome : false,
    sections: walk(nodes, true, lookup),
  };
}

function directChild(el: ElNode, pred: (node: ElNode) => boolean): ElNode | null {
  for (const child of el.children) {
    if (child.type === "el" && pred(child)) return child;
  }
  return null;
}

function classesArePanel(el: ElNode, lookup: ToneLookup): boolean {
  return classList(el).every(
    (name) => PANEL_STRUCTURAL.has(name) || lookup.byClass.has(name) || !name.startsWith("w3-"),
  );
}

function toneOf(el: ElNode, lookup: ToneLookup): ToneId {
  for (const name of classList(el)) {
    const tone = lookup.byClass.get(name);
    if (tone) return tone;
  }
  // Opaque: retain an unknown tone class so a theme swap cannot strip it on save.
  for (const name of classList(el)) {
    if (!PANEL_STRUCTURAL.has(name) && TONE_CLASS_ID.test(name)) return name;
  }
  return "plain";
}

function onlyInsert(el: ElNode): Section | null {
  const text = textContent(el).trim();
  const match = text.match(/^\{\{([A-Za-z0-9_-]+)\}\}$/);
  if (!match) return null;
  return { kind: "insert", id: match[1]! };
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
