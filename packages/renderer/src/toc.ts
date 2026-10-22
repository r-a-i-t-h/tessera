import { escapeHtml } from "./render.js";

export type TocHeading = {
  index: number;
  level: number;
  text: string;
  id: string;
};

const TOC_MARKER = /<(nav|div)\b[^>]*\bdata-tessera="toc"[^>]*>(?:\s*)<\/\1>/gi;
const HEADING_RE = /<h([1-4])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;

type Patch = { start: number; end: number; text: string };

/** Expand table-of-contents markers and assign ids to linked headings. */
export function expandToc(html: string): string {
  const markers: { start: number; end: number }[] = [];
  for (const match of html.matchAll(TOC_MARKER)) {
    const start = match.index ?? 0;
    markers.push({ start, end: start + match[0].length });
  }
  if (!markers.length) return html;

  const headings = collectHeadings(html);
  assignHeadingIds(headings);

  const patches: Patch[] = [];
  for (const heading of headings) {
    const match = html.slice(heading.index).match(/^<h([1-4])\b([^>]*)>([\s\S]*?)<\/h\1>/);
    if (!match) continue;
    const attrs = match[2] ?? "";
    if (/\bid\s*=/.test(attrs)) continue;
    const open = `<h${match[1]}${ensureIdAttr(attrs, heading.id)}>${match[3]}</h${match[1]}>`;
    patches.push({ start: heading.index, end: heading.index + match[0].length, text: open });
  }

  for (const marker of markers) {
    const entries = headings.filter((item) => item.index >= marker.end);
    patches.push({ start: marker.start, end: marker.end, text: paintTocNav(entries) });
  }

  patches.sort((a, b) => b.start - a.start);
  let out = html;
  for (const patch of patches) {
    out = out.slice(0, patch.start) + patch.text + out.slice(patch.end);
  }
  return out;
}

function collectHeadings(html: string): TocHeading[] {
  const headings: TocHeading[] = [];
  for (const match of html.matchAll(HEADING_RE)) {
    const index = match.index ?? 0;
    const level = Number(match[1]);
    const attrs = match[2] ?? "";
    const inner = match[3] ?? "";
    const text = plainHeading(inner);
    if (!text || !isQualifyingHeading(html, index, attrs)) continue;
    headings.push({
      index,
      level,
      text,
      id: "",
    });
  }
  return headings;
}

function isQualifyingHeading(html: string, hIndex: number, attrs: string): boolean {
  if (/\btessera-block\b/.test(attrs)) return true;
  if (/\bw3-text-theme\b/.test(attrs)) return false;
  const before = html.slice(0, hIndex);
  const open = before.lastIndexOf("<div");
  if (open < 0) return false;
  const tag = html.slice(open).match(/^<div\b([^>]*)>/);
  if (!tag || !/\btessera-text\b/.test(tag[1] ?? "")) return false;
  const afterOpen = html.indexOf(">", open) + 1;
  return /^\s*$/.test(html.slice(afterOpen, hIndex));
}

function assignHeadingIds(headings: TocHeading[]): void {
  const used = new Map<string, number>();
  for (const heading of headings) {
    const base = slug(heading.text);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    heading.id = count === 0 ? base : `${base}-${count + 1}`;
  }
}

function ensureIdAttr(attrs: string, id: string): string {
  if (/\bid\s*=/.test(attrs)) return attrs;
  return `${attrs} id="${escapeHtml(id)}"`;
}

function paintTocNav(headings: TocHeading[]): string {
  if (!headings.length) {
    return `<nav class="tessera-block tessera-toc" aria-label="Contents"></nav>`;
  }
  const minLevel = Math.min(...headings.map((item) => item.level));
  const items = headings
    .map((item) => {
      const depth = item.level - minLevel;
      const cls = depth > 0 ? ` class="tessera-toc-indent-${depth}"` : "";
      return `<li${cls}><a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a></li>`;
    })
    .join("");
  return `<nav class="tessera-block tessera-toc" aria-label="Contents"><p class="tessera-toc-title">Contents</p><ul class="tessera-toc-list">${items}</ul></nav>`;
}

function slug(text: string): string {
  const base = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "section";
}

function plainHeading(inner: string): string {
  return inner
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
