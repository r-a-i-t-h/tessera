import { escapeHtml } from "../dom.js";
import type { RecordList, RecordSummary } from "../api.js";
import { isParentPageCandidate } from "../pages-list.js";
import { listRecords, getRecord } from "../api.js";

export type NavBuildPaletteInfo = {
  pages: { id: string; title?: string }[];
  blogs: { id: string; title?: string }[];
  types: { id: string }[];
  tags: string[];
};

/** Site page titles for nav build labels (pages and blogs). */
export function pageTitleById(info: NavBuildPaletteInfo): Map<string, string> {
  const titles = new Map<string, string>();
  for (const row of [...info.pages, ...info.blogs]) {
    const name = row.title?.trim();
    if (name) titles.set(row.id, name);
  }
  return titles;
}

export async function loadNavBuildPalette(): Promise<NavBuildPaletteInfo> {
  try {
    const listing = await listRecords();
    return paletteFromRecords(listing);
  } catch {
    return { pages: [], blogs: [], types: [], tags: [] };
  }
}

export async function paletteFromRecords(listing: RecordList): Promise<NavBuildPaletteInfo> {
  const items = listing.records.filter((row) => row.kind === "items");
  const tags = await collectItemTags(items);
  return {
    pages: contentPages(listing.records),
    blogs: blogs(listing.records),
    types: listing.records.filter((row) => row.kind === "types").map((row) => ({ id: row.id })),
    tags,
  };
}

async function collectItemTags(items: RecordSummary[]): Promise<string[]> {
  const tags = new Set<string>();
  const payloads = await Promise.all(items.map((row) => getRecord("items", row.id).catch(() => undefined)));
  for (const payload of payloads) {
    const data = payload?.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) continue;
    const rowTags = (data as Record<string, unknown>).tags;
    if (!Array.isArray(rowTags)) continue;
    for (const tag of rowTags) {
      if (typeof tag === "string" && tag.trim()) tags.add(tag.trim());
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function contentPages(records: RecordSummary[]): { id: string; title?: string }[] {
  return records
    .filter(isParentPageCandidate)
    .map((row) => ({ id: row.id, title: row.title }))
    .sort((a, b) => (a.title ?? a.id).localeCompare(b.title ?? b.id, undefined, { sensitivity: "base" }));
}

function blogs(records: RecordSummary[]): { id: string; title?: string }[] {
  return records
    .filter((row) => row.kind === "content" && row.type === "blog")
    .map((row) => ({ id: row.id, title: row.title }))
    .sort((a, b) => (a.title ?? a.id).localeCompare(b.title ?? b.id, undefined, { sensitivity: "base" }));
}

export function navPaletteHtml(info: NavBuildPaletteInfo): string {
  const pageButtons = info.pages.map((page) => compactPageButton("page", page.id, page.title)).join("");
  const blogButtons = info.blogs.map((blog) => compactPageButton("blog", blog.id, blog.title)).join("");
  const sections = [
    paletteSection("Heading", [
      paletteButton("heading", "Heading", "Create a group with nested links", false),
    ]),
    palettePagesSection(pageButtons),
    paletteSection("Blogs", info.blogs.length ? [blogButtons] : [], true),
    paletteSection(
      "Types",
      info.types.map((type) => paletteButton(`type:${type.id}`, `Pages: ${type.id}`, `All pages of type ${type.id}`, false)),
    ),
    paletteSection(
      "Item tags",
      info.tags.map((tag) => paletteButton(`tag:${tag}`, `Tag: ${tag}`, `Pages linked to items tagged ${tag}`, false)),
    ),
  ].filter(Boolean);
  return sections.join(`<hr class="editor-palette-rule">`);
}

function palettePagesSection(pageButtons: string): string {
  if (!pageButtons) return "";
  return `<section class="nav-build-palette-section" data-nav-palette-section="pages">
    <h3 class="w3-small w3-text-grey">Pages</h3>
    <p class="nav-build-palette-filter">
      <label class="w3-small" for="nav-build-page-filter">Filter</label>
      <input id="nav-build-page-filter" type="search" class="w3-input w3-small" data-nav-palette-filter="pages" placeholder="Search pages…" autocomplete="off" />
    </p>
    <div class="nav-build-palette-list" data-nav-palette-pages>${pageButtons}</div>
  </section>`;
}

function paletteSection(title: string, buttons: string[], compact = false): string {
  const flat = buttons.flat().filter(Boolean);
  if (!flat.length) return "";
  const listClass = compact ? " nav-build-palette-list-compact" : "";
  return `<section class="nav-build-palette-section"><h3 class="w3-small w3-text-grey">${escapeHtml(title)}</h3><div class="nav-build-palette-list${listClass}">${flat.join("")}</div></section>`;
}

function compactPageButton(kind: "page" | "blog", id: string, title?: string): string {
  const display = title?.trim() || id;
  const filterText = `${display} ${id}`.toLowerCase();
  return `<button type="button" class="w3-button nav-build-palette-item nav-build-page-item" draggable="true" data-nav-palette="${escapeHtml(`${kind}:${id}`)}" data-nav-palette-filter-text="${escapeHtml(filterText)}" title="${escapeHtml(display)}">${escapeHtml(display)}</button>`;
}

function paletteButton(id: string, label: string, title: string, compact: boolean): string {
  const compactClass = compact ? " nav-build-palette-item-compact" : "";
  return `<button type="button" class="w3-button nav-build-palette-item${compactClass}" draggable="true" data-nav-palette="${escapeHtml(id)}" title="${escapeHtml(title)}">${escapeHtml(label)}</button>`;
}

/** Parse data-nav-palette into a palette kind for nodeFromPalette. */
export function parsePaletteId(id: string, info: NavBuildPaletteInfo): import("./tree.js").NavPaletteKind | undefined {
  if (id === "heading") return { kind: "heading" };
  const [kind, ...rest] = id.split(":");
  const value = rest.join(":");
  if (kind === "page") {
    const page = info.pages.find((p) => p.id === value);
    return { kind: "page", id: value, title: page?.title };
  }
  if (kind === "blog") {
    const blog = info.blogs.find((p) => p.id === value);
    return { kind: "blog", id: value, title: blog?.title };
  }
  if (kind === "type") return { kind: "type", typeId: value };
  if (kind === "tag") return { kind: "tag", tag: value };
  return undefined;
}
