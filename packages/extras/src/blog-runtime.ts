/** Local calendar day, `YYYY-MM-DD`. A future article stays hidden until this day. */
export function localDay(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** A date-only value is hidden while the visitor's local day is still before it. */
export function isFutureDate(iso: string, today = localDay()): boolean {
  const day = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return day > today;
}

export type BlogCard = {
  id: string;
  title: string;
  date: string;
  dateLabel: string;
  precis: string;
  tags: string[];
  tenant: string;
  href: string;
  heroHtml: string;
};

export type BlogState = {
  tenant?: string;
  tag?: string;
  slice: number;
};

type FeedPayload = {
  kind: "feed";
  pageId: string;
  pinned: string;
  pageSize: number;
  indexHref: string;
  blogHref: string;
  tenants: string[];
  cards: BlogCard[];
};

type IndexPayload = {
  kind: "index";
  pageId: string;
  pinned: string;
  cards: BlogCard[];
};

type ArticlePayload = {
  kind: "article";
  pageId: string;
  date: string;
  blogHref: string;
  indexHref: string;
  cards: BlogCard[];
};

type BlogPayload = FeedPayload | IndexPayload | ArticlePayload;

/** Read tenant, tag, and slice from a snapshot hash (`#news/tenant/hall`) or a pages hash (`#tenant/hall`). */
export function blogStateFromHash(hash: string, pageId: string): BlogState {
  let raw = hash.replace(/^#/, "");
  if (raw === pageId) raw = "";
  else if (raw.startsWith(`${pageId}/`)) raw = raw.slice(pageId.length + 1);
  const parts = raw.split("/").filter(Boolean);
  const state: BlogState = { slice: 0 };
  for (let i = 0; i < parts.length; i += 2) {
    const key = parts[i];
    const value = parts[i + 1];
    if (!key || value === undefined) continue;
    const decoded = decodeURIComponent(value);
    if (key === "tenant") state.tenant = decoded;
    else if (key === "tag") state.tag = decoded;
    else if (key === "slice") state.slice = Math.max(0, Number(decoded) || 0);
  }
  return state;
}

export function blogHash(pageId: string, blogHref: string, state: BlogState): string {
  const bits: string[] = [];
  if (state.tenant) bits.push("tenant", encodeURIComponent(state.tenant));
  if (state.tag) bits.push("tag", encodeURIComponent(state.tag));
  if (state.slice > 0) bits.push("slice", String(state.slice));
  const suffix = bits.join("/");
  if (!suffix) return blogHref;
  if (blogHref.startsWith("#")) return `${blogHref}/${suffix}`;
  return `${blogHref}#${suffix}`;
}

function readPayload(host: Element): BlogPayload | undefined {
  const script = host.querySelector(".tessera-blog-data");
  if (!script?.textContent) return undefined;
  try {
    return JSON.parse(script.textContent) as BlogPayload;
  } catch {
    return undefined;
  }
}

function visible(cards: readonly BlogCard[], today: string): BlogCard[] {
  return cards.filter((card) => !isFutureDate(card.date, today));
}

/** Paint blog lists, the index, and article chrome from the published JSON. */
export function bootBlog(root: ParentNode = document, today = localDay()): void {
  root.querySelectorAll("[data-tessera-blog]").forEach((host) => {
    if (!(host instanceof HTMLElement)) return;
    const payload = readPayload(host);
    if (!payload) return;
    if (payload.kind === "article") paintArticle(host, payload, today);
    else if (payload.kind === "feed") paintFeed(host, payload, today);
    else paintIndex(host, payload, today);
  });
}

function paintArticle(host: HTMLElement, payload: ArticlePayload, today: string): void {
  const live = host.querySelector<HTMLElement>(".tessera-blog-live");
  const pending = host.querySelector<HTMLElement>(".tessera-blog-pending");
  const future = isFutureDate(payload.date, today);
  if (live) live.hidden = future;
  if (pending) pending.hidden = !future;
  const nav = host.querySelector<HTMLElement>(".tessera-blog-neighbors");
  if (!nav || future) {
    if (nav) nav.innerHTML = "";
    return;
  }
  const cards = visible(payload.cards, today);
  const index = cards.findIndex((card) => card.id === payload.pageId);
  const newer = index > 0 ? cards[index - 1] : undefined;
  const older = index >= 0 ? cards[index + 1] : undefined;
  const bits = [
    older ? `<a href="${escapeAttr(older.href)}">Previous: ${escapeText(older.title)}</a>` : "",
    `<a href="${escapeAttr(payload.blogHref)}">Blog</a>`,
    `<a href="${escapeAttr(payload.indexHref)}">Index</a>`,
    newer ? `<a href="${escapeAttr(newer.href)}">Next: ${escapeText(newer.title)}</a>` : "",
  ].filter(Boolean);
  nav.innerHTML = bits.join("");
}

function paintFeed(host: HTMLElement, payload: FeedPayload, today: string): void {
  const state = blogStateFromHash(window.location.hash, payload.pageId);
  const tenant = payload.pinned || state.tenant || "";
  const mount = host.querySelector<HTMLElement>(".tessera-blog-mount");
  const tags = host.querySelector<HTMLElement>(".tessera-blog-tags");
  const pager = host.querySelector<HTMLElement>(".tessera-blog-pager");
  const prompt = host.querySelector<HTMLElement>(".tessera-blog-prompt");
  if (prompt) prompt.hidden = Boolean(tenant);
  if (!tenant) {
    if (mount) mount.innerHTML = "";
    if (tags) tags.innerHTML = "";
    if (pager) pager.innerHTML = "";
    return;
  }
  const cards = visible(payload.cards, today).filter((card) => payload.pinned || card.tenant === tenant);
  const tag = state.tag ?? "";
  const filtered = tag ? cards.filter((card) => card.tags.includes(tag)) : cards;
  const size = payload.pageSize > 0 ? payload.pageSize : 10;
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const slice = Math.min(state.slice, pages - 1);
  const shown = filtered.slice(slice * size, slice * size + size);
  if (tags) tags.innerHTML = tagLinks(payload, cards, tenant, tag);
  if (mount) mount.innerHTML = shown.map(cardHtml).join("") || `<p class="tessera-blog-empty">No articles.</p>`;
  if (pager) {
    const newer = slice > 0 ? pageLink(payload, tenant, tag, slice - 1, "Newer") : "";
    const older = slice + 1 < pages ? pageLink(payload, tenant, tag, slice + 1, "Older") : "";
    pager.innerHTML = [newer, older].filter(Boolean).join("");
  }
}

function paintIndex(host: HTMLElement, payload: IndexPayload, today: string): void {
  const state = blogStateFromHash(window.location.hash, payload.pageId);
  const query = host.querySelector<HTMLInputElement>(".tessera-blog-query");
  if (query && query.oninput === null) {
    query.oninput = () => paintIndex(host, payload, localDay());
  }
  const text = query?.value.trim().toLowerCase() ?? "";
  const cards = visible(payload.cards, today).filter((card) => {
    if (payload.pinned && card.tenant !== payload.pinned) return false;
    if (state.tag && !card.tags.includes(state.tag)) return false;
    if (!text) return true;
    const haystack = `${card.title} ${card.tags.join(" ")}`.toLowerCase();
    return haystack.includes(text);
  });
  const tags = host.querySelector<HTMLElement>(".tessera-blog-tags");
  const mount = host.querySelector<HTMLElement>(".tessera-blog-mount");
  if (tags) {
    const pool = visible(payload.cards, today);
    tags.innerHTML = indexTagLinks(payload, pool, state.tag ?? "");
  }
  if (mount) {
    mount.innerHTML =
      cards.map((card) => indexRow(card, !payload.pinned)).join("") || `<p class="tessera-blog-empty">No articles.</p>`;
  }
}

function tagLinks(payload: FeedPayload, cards: readonly BlogCard[], tenant: string, current: string): string {
  const tags = uniqueTags(cards);
  if (!tags.length) return "";
  const all = blogHash(payload.pageId, payload.blogHref, { tenant: payload.pinned ? undefined : tenant, slice: 0 });
  const links = tags.map((tag) => {
    const href = blogHash(payload.pageId, payload.blogHref, {
      tenant: payload.pinned ? undefined : tenant,
      tag,
      slice: 0,
    });
    const on = tag === current ? ` aria-current="true"` : "";
    return `<a href="${escapeAttr(href)}"${on}>${escapeText(tag)}</a>`;
  });
  return `<a href="${escapeAttr(all)}"${current ? "" : ` aria-current="true"`}>All</a>${links.join("")}`;
}

function indexTagLinks(payload: IndexPayload, cards: readonly BlogCard[], current: string): string {
  const tags = uniqueTags(cards);
  const base = hashBase(payload.pageId);
  const all = blogHash(payload.pageId, base, { slice: 0 });
  const links = tags.map((tag) => {
    const href = blogHash(payload.pageId, base, { tag, slice: 0 });
    const on = tag === current ? ` aria-current="true"` : "";
    return `<a href="${escapeAttr(href)}"${on}>${escapeText(tag)}</a>`;
  });
  return `<a href="${escapeAttr(all)}"${current ? "" : ` aria-current="true"`}>All</a>${links.join("")}`;
}

function hashBase(pageId: string): string {
  const hash = window.location.hash.replace(/^#/, "");
  if (hash === pageId || hash.startsWith(`${pageId}/`)) return `#${pageId}`;
  const path = window.location.pathname + window.location.search;
  return path || "./";
}

function pageLink(payload: FeedPayload, tenant: string, tag: string, slice: number, label: string): string {
  const href = blogHash(payload.pageId, payload.blogHref, {
    tenant: payload.pinned ? undefined : tenant,
    ...(tag ? { tag } : {}),
    slice,
  });
  return `<a href="${escapeAttr(href)}">${label}</a>`;
}

function cardHtml(card: BlogCard): string {
  const hero = card.heroHtml ? `<div class="tessera-blog-hero">${card.heroHtml}</div>` : "";
  return `<article class="tessera-blog-card">${hero}<h2><a href="${escapeAttr(card.href)}">${escapeText(card.title)}</a></h2><p class="tessera-blog-meta"><time datetime="${escapeAttr(card.date)}">${escapeText(card.dateLabel)}</time></p>${card.precis ? `<p>${escapeText(card.precis)}</p>` : ""}</article>`;
}

function indexRow(card: BlogCard, showTenant: boolean): string {
  const tags = card.tags.map((tag) => `<span>${escapeText(tag)}</span>`).join(" ");
  const tenant = showTenant ? `<span class="tessera-blog-tenant">${escapeText(card.tenant)}</span>` : "";
  return `<p class="tessera-blog-index-row"><time datetime="${escapeAttr(card.date)}">${escapeText(card.dateLabel)}</time> <a href="${escapeAttr(card.href)}">${escapeText(card.title)}</a> ${tenant} ${tags}</p>`;
}

function uniqueTags(cards: readonly BlogCard[]): string[] {
  const tags = new Set<string>();
  for (const card of cards) for (const tag of card.tags) tags.add(tag);
  return [...tags].sort((a, b) => a.localeCompare(b));
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}
