import { blogHeroStyle, type Page, type SiteDocument } from "@r-a-i-t-h/tessera-model";
import { hrefForPage, type ComponentFn } from "@r-a-i-t-h/tessera-renderer";
import type { BlogCard } from "./blog-runtime.js";
import { formatDate } from "./willow.js";

function embed(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function pageSize(page: Page): number {
  const raw = page.fields?.pageSize?.trim() ?? "";
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 10;
}

function byDate(a: Page, b: Page): number {
  const left = a.fields?.date ?? "";
  const right = b.fields?.date ?? "";
  if (left === right) return a.title.localeCompare(b.title);
  return left < right ? 1 : -1;
}

function blogPage(document: SiteDocument, page: Page): Page | undefined {
  if (!page.parentId) return undefined;
  const parent = document.pages.find((item) => item.id === page.parentId);
  return parent?.type === "blog" ? parent : undefined;
}

function indexPage(document: SiteDocument, blog: Page): Page | undefined {
  return document.pages.find((page) => page.type === "blog-index" && page.parentId === blog.id);
}

function articlesFor(document: SiteDocument, blog: Page): Page[] {
  return document.pages.filter((page) => page.type === "article" && page.parentId === blog.id).sort(byDate);
}

function card(ctx: Parameters<ComponentFn>[0], page: Page): BlogCard {
  const hero = page.fields?.hero?.trim() ?? "";
  const date = page.fields?.date ?? "";
  return {
    id: page.id,
    title: page.title,
    date,
    dateLabel: date ? formatDate(date) : "",
    precis: page.fields?.precis ?? "",
    tags: page.tags ?? [],
    tenant: page.fields?.tenant ?? "",
    href: hrefForPage(ctx, page.id),
    heroHtml: hero ? ctx.mediaHtml(hero) : "",
  };
}

function hashHref(base: string, suffix: string): string {
  if (!suffix) return base;
  return base.startsWith("#") ? `${base}/${suffix}` : `${base}#${suffix}`;
}

export const blogArticle: ComponentFn = (ctx) => {
  const page = ctx.page;
  const blog = blogPage(ctx.document, page);
  const index = blog ? indexPage(ctx.document, blog) : undefined;
  const blogHref = blog ? hrefForPage(ctx, blog.id) : "#";
  const indexHref = index ? hrefForPage(ctx, index.id) : blogHref;
  const same = blog
    ? articlesFor(ctx.document, blog).filter((item) => item.fields?.tenant === page.fields?.tenant)
    : [];
  const payload = {
    kind: "article",
    pageId: page.id,
    date: page.fields?.date ?? "",
    blogHref,
    indexHref,
    cards: same.map((item) => card(ctx, item)),
  };
  const hero = page.fields?.hero?.trim() ?? "";
  const heroHtml = hero ? `<div class="tessera-blog-hero">${ctx.mediaHtml(hero)}</div>` : "";
  const author = page.fields?.author?.trim() ?? "";
  const byline = [page.fields?.date ? formatDate(page.fields.date) : "", author].filter(Boolean).join(" · ");
  const tags = (page.tags ?? [])
    .map((tag) => {
      const href = hashHref(indexHref, `tag/${encodeURIComponent(tag)}`);
      return `<a href="${ctx.escapeHtml(href)}">${ctx.escapeHtml(tag)}</a>`;
    })
    .join(" ");
  const title = ctx.escapeHtml(page.title);
  const body = ctx.renderBlocks(ctx.zones.get("main") ?? []);
  const style = blogHeroStyle(blog?.fields);
  return `<article data-tessera-blog="article" data-hero="${style}">
    <script type="application/json" class="tessera-blog-data">${embed(payload)}</script>
    <div class="tessera-blog-live">
      ${heroHtml}
      <h1>${title}</h1>
      ${byline ? `<p class="tessera-blog-byline">${ctx.escapeHtml(byline)}</p>` : ""}
      ${tags ? `<p class="tessera-blog-tags">${tags}</p>` : ""}
      <div class="tessera-blog-body">${body}</div>
      <nav class="tessera-blog-neighbors" aria-label="Article"></nav>
    </div>
    <p class="tessera-blog-pending" hidden>This article is not yet available.</p>
  </article>`;
};

export const blogFeed: ComponentFn = (ctx) => {
  const blog = ctx.page;
  const index = indexPage(ctx.document, blog);
  const blogHref = hrefForPage(ctx, blog.id);
  const indexHref = index ? hrefForPage(ctx, index.id) : "";
  const pinned = blog.fields?.tenant?.trim() ?? "";
  const tenants = (ctx.document.tenants ?? []).map((tenant) => tenant.id);
  const payload = {
    kind: "feed",
    pageId: blog.id,
    pinned,
    pageSize: pageSize(blog),
    indexHref,
    blogHref,
    tenants,
    cards: articlesFor(ctx.document, blog).map((page) => card(ctx, page)),
  };
  const choices = pinned
    ? ""
    : `<nav class="tessera-blog-tenants" aria-label="Tenants">${tenants
        .map((id) => `<a href="${ctx.escapeHtml(hashHref(blogHref, `tenant/${encodeURIComponent(id)}`))}">${ctx.escapeHtml(id)}</a>`)
        .join("")}</nav>`;
  const indexLink = indexHref ? `<p class="tessera-blog-index-link"><a href="${ctx.escapeHtml(indexHref)}">Index</a></p>` : "";
  return `<section data-tessera-blog="feed">
    <script type="application/json" class="tessera-blog-data">${embed(payload)}</script>
    ${choices}
    <p class="tessera-blog-prompt"${pinned ? " hidden" : ""}>Choose a tenant.</p>
    <nav class="tessera-blog-tags" aria-label="Tags"></nav>
    <div class="tessera-blog-mount">${payload.cards.map((card) => publishedCard(card)).join("")}</div>
    <nav class="tessera-blog-pager" aria-label="Pages"></nav>
    ${indexLink}
  </section>`;
};

export const blogIndex: ComponentFn = (ctx) => {
  const index = ctx.page;
  const blog = index.parentId ? ctx.document.pages.find((page) => page.id === index.parentId) : undefined;
  const pinned = blog?.type === "blog" ? (blog.fields?.tenant?.trim() ?? "") : "";
  const cards = blog && blog.type === "blog" ? articlesFor(ctx.document, blog).map((page) => card(ctx, page)) : [];
  const payload = { kind: "index", pageId: index.id, pinned, cards };
  return `<section data-tessera-blog="index">
    <script type="application/json" class="tessera-blog-data">${embed(payload)}</script>
    <div class="tessera-blog-tools">
      <nav class="tessera-blog-tags" aria-label="Tags"></nav>
      <p><label>Search <input class="tessera-blog-query" type="search" /></label></p>
    </div>
    <div class="tessera-blog-mount">${cards.map((item) => publishedIndexRow(item, !pinned)).join("")}</div>
  </section>`;
};

function publishedCard(card: BlogCard, showTenant = false): string {
  const hero = card.heroHtml ? `<div class="tessera-blog-hero">${card.heroHtml}</div>` : "";
  const tenant = showTenant ? ` <span class="tessera-blog-tenant">${escape(card.tenant)}</span>` : "";
  const precis = card.precis ? `<p>${escape(card.precis)}</p>` : "";
  return `<article class="tessera-blog-card">${hero}<h2><a href="${escape(card.href)}">${escape(card.title)}</a></h2><p class="tessera-blog-meta"><time datetime="${escape(card.date)}">${escape(card.dateLabel)}</time>${tenant}</p>${precis}</article>`;
}

function publishedIndexRow(card: BlogCard, showTenant: boolean): string {
  const tags = card.tags.map((tag) => `<span>${escape(tag)}</span>`).join(" ");
  const tenant = showTenant ? ` <span class="tessera-blog-tenant">${escape(card.tenant)}</span>` : "";
  return `<p class="tessera-blog-index-row"><time datetime="${escape(card.date)}">${escape(card.dateLabel)}</time> <a href="${escape(card.href)}">${escape(card.title)}</a>${tenant} ${tags}</p>`;
}

function escape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
