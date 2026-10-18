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

  return { nav, articles };
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

/** Modal body for choosing a page id or external URL. */
export function renderPageTargetPicker(choices: PageTargetChoices, currentHref: string): string {
  const external = isLikelyExternalHref(currentHref.trim()) ? currentHref.trim() : "";
  const navItems = choices.nav
    .map((page) => {
      const label = pageLabel(page);
      const selected = page.id === currentHref.trim() ? ' aria-current="true"' : "";
      const indent = page.depth > 0 ? ` style="padding-left:${page.depth * 1.25}rem"` : "";
      return `<li${indent}><button type="button" class="w3-button w3-white editor-page-target-row" data-pick-page="${escapeHtml(page.id)}"${selected}>${escapeHtml(label)}</button></li>`;
    })
    .join("");
  const navBlock = navItems
    ? `<section class="editor-page-target-section"><h3 class="w3-medium">Navigation</h3><ul class="w3-ul editor-page-target-list">${navItems}</ul></section>`
    : `<p class="w3-text-grey">No navigation pages. Add links on the Nav record.</p>`;

  const articleBlocks = choices.articles
    .map((group) => {
      const heading = group.blogTitle && group.blogTitle !== group.blogId ? `${group.blogTitle} (${group.blogId})` : group.blogId;
      const items = group.pages
        .map((page) => {
          const label = pageLabel(page);
          const selected = page.id === currentHref.trim() ? ' aria-current="true"' : "";
          return `<li><button type="button" class="w3-button w3-white editor-page-target-row" data-pick-page="${escapeHtml(page.id)}"${selected}>${escapeHtml(label)}</button></li>`;
        })
        .join("");
      if (!items) return "";
      return `<section class="editor-page-target-section"><h4 class="w3-medium">${escapeHtml(heading)}</h4><ul class="w3-ul editor-page-target-list">${items}</ul></section>`;
    })
    .filter(Boolean)
    .join("");
  const articlesBlock = articleBlocks
    ? `<section class="editor-page-target-section"><h3 class="w3-medium">Articles</h3>${articleBlocks}</section>`
    : "";

  return `<div class="editor-page-target-picker">
    ${navBlock}
    ${articlesBlock}
    <section class="editor-page-target-section editor-page-target-external">
      <h3 class="w3-medium">External URL</h3>
      <p class="w3-small w3-text-grey">Use a full address for off-site links (e.g. <code>https://…</code>).</p>
      <p><label for="page-target-external">URL</label>
        <input id="page-target-external" class="w3-input w3-border" data-page-target-external value="${escapeHtml(external)}" /></p>
      <p><button type="button" class="w3-button w3-theme" data-page-target-use-url>Use this URL</button></p>
    </section>
  </div>`;
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
  return o.nav.every(isNavPageChoice) && o.articles.every(isArticleGroup);
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
