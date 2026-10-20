import { collectNavPageOrder, resolveNavTree, type NavEntry } from "@r-a-i-t-h/tessera-model";
import type { RecordList, RecordSummary } from "../api.js";
import { sortArticles } from "../articles-list.js";
import { buildContentCreationRank } from "../creation-rank.js";
import { escapeHtml } from "../dom.js";
import { buildNavSortDocument } from "../pages-list.js";
import type { PageChoice } from "./nav.js";

export type NavPageChoice = PageChoice & { depth: number };

export type ArticleGroup = {
  blogId: string;
  blogTitle?: string;
  pages: PageChoice[];
};

export type PageTargetChoices = {
  nav: NavPageChoice[];
  /** All content pages (excluding articles), for wiki-style linking. */
  pages: PageChoice[];
  articles: ArticleGroup[];
};

export function buildPageTargetChoices(
  listing: RecordList,
  siteData: Record<string, unknown>,
  navEntries: NavEntry[],
): PageTargetChoices {
  const byId = pageTitleById(listing.records);
  const contentForNav = listing.records.filter((row) => row.kind === "content" && row.type !== "article");
  const items = listing.records.filter((row) => row.kind === "items");
  const doc = buildNavSortDocument(siteData, navEntries, contentForNav, items);
  const allowed = new Set(
    listing.records.filter((row) => row.kind === "content" && row.type !== "article").map((row) => row.id),
  );
  const tree = resolveNavTree(doc);
  const ordered = collectNavPageOrder(tree, allowed);
  const nav: NavPageChoice[] = ordered.map(({ id, depth }) => ({
    id,
    title: byId.get(id),
    depth,
  }));
  const pages: PageChoice[] = contentForNav
    .map((row) => ({ id: row.id, title: row.title }))
    .sort((a, b) => (a.title ?? a.id).localeCompare(b.title ?? b.id, undefined, { sensitivity: "base" }));

  const blogs = listing.records.filter((row) => row.kind === "content" && row.type === "blog");
  const blogTitle = new Map(blogs.map((row) => [row.id, row.title ?? row.id]));
  const rank = buildContentCreationRank(listing.records);
  const articlesByBlog = new Map<string, RecordSummary[]>();
  for (const row of listing.records) {
    if (row.kind !== "content" || row.type !== "article" || !row.parentId) continue;
    const list = articlesByBlog.get(row.parentId) ?? [];
    list.push(row);
    articlesByBlog.set(row.parentId, list);
  }
  const articles: ArticleGroup[] = [...articlesByBlog.entries()]
    .sort(([a], [b]) => (blogTitle.get(a) ?? a).localeCompare(blogTitle.get(b) ?? b, undefined, { sensitivity: "base" }))
    .map(([blogId, rows]) => ({
      blogId,
      blogTitle: blogTitle.get(blogId),
      pages: sortArticles(rows, "date", rank).map((row) => ({ id: row.id, title: row.title })),
    }));

  return { nav, pages, articles };
}

export function parsePageTargetChoices(raw: string | undefined): PageTargetChoices | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const data: unknown = JSON.parse(raw);
    if (!isPageTargetChoices(data)) return undefined;
    return data;
  } catch {
    return undefined;
  }
}

export function serializePageTargetChoices(choices: PageTargetChoices): string {
  return JSON.stringify(choices);
}

const PANELS_KEY = "tessera.pageTarget.panels";

export type PageTargetSectionId = "nav" | "pages" | "articles";

type StoredPanels = Partial<Record<PageTargetSectionId, boolean>>;

function storedPanels(): StoredPanels {
  try {
    const raw = localStorage.getItem(PANELS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as StoredPanels;
  } catch {
    return {};
  }
}

function savePanels(state: StoredPanels): void {
  try {
    localStorage.setItem(PANELS_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/** Whether a page-picker section starts open. Default collapsed. */
export function readPageTargetSectionOpen(id: PageTargetSectionId): boolean {
  const stored = storedPanels();
  if (Object.prototype.hasOwnProperty.call(stored, id)) return stored[id]!;
  return false;
}

function writePageTargetSectionOpen(id: PageTargetSectionId, open: boolean): void {
  const state = storedPanels();
  state[id] = open;
  savePanels(state);
}

export function bindPageTargetPickerPanels(root: ParentNode): void {
  for (const id of ["nav", "pages", "articles"] as const) {
    const section = root.querySelector<HTMLDetailsElement>(
      `details.editor-page-target-section[data-page-target-section="${id}"]`,
    );
    section?.addEventListener("toggle", () => writePageTargetSectionOpen(id, section.open));
  }
}

/** Modal body for choosing a page id or external URL. */
export function renderPageTargetPicker(choices: PageTargetChoices, currentHref: string): string {
  const trimmed = currentHref.trim();
  const external = isLikelyExternalHref(trimmed) ? trimmed : "";
  const currentPageBanner = pageLinkTargetBanner(choices, trimmed);
  const navItems = choices.nav
    .map((page) => {
      const label = pageLabel(page);
      const selected = page.id === trimmed ? ' aria-current="true"' : "";
      const indent = page.depth > 0 ? ` style="padding-left:${page.depth * 1.25}rem"` : "";
      return `<li${indent}><button type="button" class="w3-button w3-white editor-page-target-row" data-pick-page="${escapeHtml(page.id)}"${selected}>${escapeHtml(label)}</button></li>`;
    })
    .join("");
  const navBody = navItems
    ? `<ul class="w3-ul editor-page-target-list">${navItems}</ul>`
    : `<p class="w3-text-grey">No navigation pages. Add links on the Nav record.</p>`;
  const navBlock = pageTargetCollapsibleSection("nav", "Navigation", navBody);

  const allPages = (choices.pages ?? [])
    .map((page) => {
      const label = pageLabel(page);
      const selected = page.id === trimmed ? ' aria-current="true"' : "";
      return `<li><button type="button" class="w3-button w3-white editor-page-target-row" data-pick-page="${escapeHtml(page.id)}"${selected}>${escapeHtml(label)}</button></li>`;
    })
    .join("");
  const pagesBlock = allPages
    ? pageTargetCollapsibleSection("pages", "All pages", `<ul class="w3-ul editor-page-target-list">${allPages}</ul>`)
    : "";

  const articleBlocks = choices.articles
    .map((group) => {
      const heading = group.blogTitle && group.blogTitle !== group.blogId ? `${group.blogTitle} (${group.blogId})` : group.blogId;
      const items = group.pages
        .map((page) => {
          const label = pageLabel(page);
          const selected = page.id === trimmed ? ' aria-current="true"' : "";
          return `<li><button type="button" class="w3-button w3-white editor-page-target-row" data-pick-page="${escapeHtml(page.id)}"${selected}>${escapeHtml(label)}</button></li>`;
        })
        .join("");
      if (!items) return "";
      return `<section class="editor-page-target-section"><h4 class="w3-medium">${escapeHtml(heading)}</h4><ul class="w3-ul editor-page-target-list">${items}</ul></section>`;
    })
    .filter(Boolean)
    .join("");
  const articlesBlock = articleBlocks ? pageTargetCollapsibleSection("articles", "Articles", articleBlocks) : "";

  const externalBlock = `<section class="editor-page-target-section editor-page-target-external">
      <p><label for="page-target-external">External url</label>
        <input id="page-target-external" class="w3-input w3-border" data-page-target-external value="${escapeHtml(external)}" /></p>
      <p><button type="button" class="w3-button w3-theme" data-page-target-use-url>Use this URL</button></p>
    </section>`;

  return `<div class="editor-page-target-picker">
    ${currentPageBanner}
    ${externalBlock}
    ${navBlock}
    ${pagesBlock}
    ${articlesBlock}
  </div>`;
}

function pageLinkTargetBanner(choices: PageTargetChoices, current: string): string {
  if (!current || isLikelyExternalHref(current)) return "";
  const page = findPageChoice(choices, current);
  const label = page ? pageLabel(page) : current;
  const note = page ? "" : `<span class="w3-text-grey"> (unknown page)</span>`;
  return `<p class="editor-page-target-current">Page link: <strong>${escapeHtml(label)}</strong>${note}</p>`;
}

function findPageChoice(choices: PageTargetChoices, id: string): PageChoice | undefined {
  const hit = choices.nav.find((page) => page.id === id);
  if (hit) return hit;
  const fromPages = choices.pages?.find((page) => page.id === id);
  if (fromPages) return fromPages;
  for (const group of choices.articles) {
    const article = group.pages.find((page) => page.id === id);
    if (article) return article;
  }
  return undefined;
}

function pageTargetCollapsibleSection(id: PageTargetSectionId, title: string, body: string): string {
  const open = readPageTargetSectionOpen(id) ? " open" : "";
  return `<details class="editor-page-target-section editor-page-target-collapsible" data-page-target-section="${id}"${open}>
    <summary class="w3-medium">${escapeHtml(title)}</summary>
    ${body}
  </details>`;
}

function pageLabel(page: PageChoice): string {
  return page.title && page.title !== page.id ? `${page.title} (${page.id})` : page.id;
}

function pageTitleById(records: readonly RecordSummary[]): Map<string, string | undefined> {
  const map = new Map<string, string | undefined>();
  for (const row of records) {
    if (row.kind === "content") map.set(row.id, row.title);
  }
  return map;
}

function isLikelyExternalHref(href: string): boolean {
  if (!href) return false;
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//");
}

function isPageTargetChoices(value: unknown): value is PageTargetChoices {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (!Array.isArray(o.nav) || !Array.isArray(o.articles)) return false;
  if (o.pages !== undefined && (!Array.isArray(o.pages) || !o.pages.every(isPageChoice))) return false;
  return o.nav.every(isNavPageChoice) && o.articles.every(isArticleGroup);
}

function isPageChoice(value: unknown): value is PageChoice {
  return !!value && typeof value === "object" && typeof (value as PageChoice).id === "string";
}

function isNavPageChoice(value: unknown): value is NavPageChoice {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.depth === "number";
}

function isArticleGroup(value: unknown): value is ArticleGroup {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (typeof o.blogId !== "string" || !Array.isArray(o.pages)) return false;
  return o.pages.every((p) => p && typeof p === "object" && typeof (p as PageChoice).id === "string");
}
