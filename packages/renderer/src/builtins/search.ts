import type { ComponentFn } from "../types.js";
import { hrefForPage } from "../page-href.js";
import {
  loadSearchEngine,
  runSearch,
  type SearchHit,
  type SearchIndexPayload,
} from "../search-index.js";
import type MiniSearch from "minisearch";
import type { SearchIndexDocument } from "../search-index.js";

const TYPEAHEAD_LIMIT = 8;
const RESULTS_LIMIT = 50;

type LoadedIndex = {
  mini: MiniSearch<SearchIndexDocument>;
  facets: { tags: string[]; types: string[] };
};

let indexPromise: Promise<LoadedIndex | null> | null = null;
let indexUrlCached: string | null = null;
let slashFocusBound = false;

function indexHref(ctx: Parameters<ComponentFn>[0]): string {
  const raw = "./search-index.json";
  return ctx.assetUrl ? ctx.assetUrl(raw) : raw;
}

function resultsHref(ctx: Parameters<ComponentFn>[0], resultsPageId: string, query?: string): string {
  const base = hrefForPage(ctx, resultsPageId);
  if (!query?.trim()) return base;
  const q = `q=${encodeURIComponent(query.trim())}`;
  if (base.startsWith("#")) {
    const id = base.slice(1).split(/[/?]/)[0] ?? resultsPageId;
    return `#${id}?${q}`;
  }
  const join = base.includes("?") ? "&" : base.endsWith("/") || base === "" || base.endsWith("#") ? "?" : "/?";
  if (base.endsWith("/")) return `${base}?${q}`;
  if (base.includes("?")) return `${base}&${q}`;
  return `${base}${join}${q}`;
}

/** Layout chrome: typeahead search box. Props: `resultsPageId` (default `search`), `placeholder`. */
export const searchBox: ComponentFn = (ctx, props = {}) => {
  const resultsPageId =
    typeof props.resultsPageId === "string" && props.resultsPageId.trim()
      ? props.resultsPageId.trim()
      : "search";
  const placeholder =
    typeof props.placeholder === "string" && props.placeholder.trim()
      ? props.placeholder.trim()
      : "Search…";
  const index = ctx.escapeHtml(indexHref(ctx));
  const results = ctx.escapeHtml(hrefForPage(ctx, resultsPageId));
  const pageExists = ctx.document.pages.some((p) => p.id === resultsPageId);
  return `<div class="tessera-search tessera-search-box" data-tessera-search="box" data-search-index="${index}" data-search-results-page="${ctx.escapeHtml(resultsPageId)}" data-search-results-href="${results}"${pageExists ? "" : ' data-search-results-missing="1"'}>
  <label class="tessera-search-label w3-hide">Search</label>
  <input type="search" class="w3-input w3-border tessera-search-input" placeholder="${ctx.escapeHtml(placeholder)}" autocomplete="off" enterkeyhint="search" aria-label="Search" role="combobox" aria-autocomplete="list" aria-expanded="false" />
  <ul class="tessera-search-suggest w3-ul w3-card w3-white" hidden role="listbox"></ul>
</div>`;
};

/** Page body: full results with refine / filter / sort. Props: `resultsPageId` (default current page id). */
export const searchResults: ComponentFn = (ctx, props = {}) => {
  const resultsPageId =
    typeof props.resultsPageId === "string" && props.resultsPageId.trim()
      ? props.resultsPageId.trim()
      : ctx.page.id;
  const index = ctx.escapeHtml(indexHref(ctx));
  const selfHref = ctx.escapeHtml(hrefForPage(ctx, resultsPageId));
  return `<div class="tessera-search tessera-search-results" data-tessera-search="results" data-search-index="${index}" data-search-results-page="${ctx.escapeHtml(resultsPageId)}" data-search-results-href="${selfHref}">
  <form class="tessera-search-refine w3-margin-bottom" action="#" method="get" role="search">
    <p><label class="w3-hide" for="tessera-search-q">Query</label>
      <input id="tessera-search-q" name="q" type="search" class="w3-input w3-border tessera-search-input" placeholder="Search…" autocomplete="off" /></p>
    <div class="tessera-search-controls w3-row-padding" style="margin-left:-8px;margin-right:-8px">
      <div class="w3-col m4">
        <label for="tessera-search-tag">Tag</label>
        <select id="tessera-search-tag" name="tag" class="w3-select w3-border tessera-search-tag"><option value="">Any tag</option></select>
      </div>
      <div class="w3-col m4">
        <label for="tessera-search-type">Type</label>
        <select id="tessera-search-type" name="type" class="w3-select w3-border tessera-search-type"><option value="">Any type</option></select>
      </div>
      <div class="w3-col m4">
        <label for="tessera-search-sort">Sort</label>
        <select id="tessera-search-sort" name="sort" class="w3-select w3-border tessera-search-sort">
          <option value="relevance">Relevance</option>
          <option value="title">Title A–Z</option>
        </select>
      </div>
    </div>
  </form>
  <p class="tessera-search-status w3-text-grey" aria-live="polite"></p>
  <ul class="tessera-search-list w3-ul"></ul>
</div>`;
};

export function registerSearchComponents(define: (name: string, fn: ComponentFn) => unknown): void {
  define("searchBox", searchBox);
  define("searchResults", searchResults);
}

/** Enhance search mounts. Safe to call after each SPA render or pages hydrate. */
export function bootSearch(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-tessera-search]").forEach((host) => {
    if (host.dataset.searchBooted === "1") {
      if (host.dataset.tesseraSearch === "results") syncResultsFromUrl(host);
      return;
    }
    host.dataset.searchBooted = "1";
    if (host.dataset.tesseraSearch === "box") wireBox(host);
    else if (host.dataset.tesseraSearch === "results") wireResults(host);
  });
}

function wireBox(host: HTMLElement): void {
  ensureSlashFocusShortcut();

  const input = host.querySelector<HTMLInputElement>(".tessera-search-input");
  const suggest = host.querySelector<HTMLElement>(".tessera-search-suggest");
  if (!input || !suggest) return;

  const mountId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `search-${Math.random().toString(36).slice(2)}`;
  const inputId = `tessera-search-input-${mountId}`;
  const listId = `tessera-search-list-${mountId}`;
  input.id = inputId;
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", listId);
  input.setAttribute("aria-expanded", "false");
  suggest.id = listId;

  let activeIndex = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const getOptions = () => suggest.querySelectorAll<HTMLElement>('[role="option"]');

  const setActive = (index: number) => {
    const options = getOptions();
    const next = index < 0 || index >= options.length ? -1 : index;
    activeIndex = next;
    options.forEach((opt, i) => {
      opt.setAttribute("aria-selected", i === next ? "true" : "false");
    });
    if (next >= 0) {
      const active = options[next];
      input.setAttribute("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  };

  const hideSuggest = () => {
    suggest.hidden = true;
    input.setAttribute("aria-expanded", "false");
    setActive(-1);
  };

  const showSuggest = () => {
    suggest.hidden = false;
    input.setAttribute("aria-expanded", "true");
  };

  const run = () => {
    void (async () => {
      const q = input.value.trim();
      if (!q) {
        suggest.innerHTML = "";
        hideSuggest();
        return;
      }
      const loaded = await ensureIndex(host);
      if (!loaded) {
        suggest.innerHTML = `<li class="w3-text-grey">Search index unavailable.</li>`;
        setActive(-1);
        showSuggest();
        return;
      }
      const hits = runSearch(loaded.mini, { query: q, limit: TYPEAHEAD_LIMIT });
      if (!hits.length) {
        suggest.innerHTML = `<li class="w3-text-grey">No matches.</li>`;
        setActive(-1);
        showSuggest();
        return;
      }
      const resultsHrefBase = host.dataset.searchResultsHref ?? "#search";
      const resultsPageId = host.dataset.searchResultsPage ?? "search";
      const missing = host.dataset.searchResultsMissing === "1";
      suggest.innerHTML =
        hits.map((hit, i) => suggestRow(hit, pageHrefFromHost(host, hit), listId, i)).join("") +
        (missing
          ? ""
          : `<li role="option" id="${escapeAttr(`${listId}-opt-${hits.length}`)}" aria-selected="false"><a class="tessera-search-see-all" href="${escapeAttr(withQuery(resultsHrefBase, resultsPageId, q))}" tabindex="-1">See all results</a></li>`);
      setActive(-1);
      showSuggest();
    })();
  };

  input.addEventListener("focus", () => {
    void ensureIndex(host);
    if (input.value.trim()) run();
  });
  input.addEventListener("input", () => {
    setActive(-1);
    clearTimeout(timer);
    timer = setTimeout(run, 120);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideSuggest();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (suggest.hidden) return;
      const options = getOptions();
      if (!options.length) return;
      event.preventDefault();
      if (event.key === "ArrowDown") {
        setActive(activeIndex < options.length - 1 ? activeIndex + 1 : activeIndex);
      } else if (activeIndex <= 0) {
        setActive(-1);
      } else {
        setActive(activeIndex - 1);
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0) {
        const option = getOptions()[activeIndex];
        const href = option?.querySelector("a")?.getAttribute("href");
        if (href) window.location.assign(href);
        return;
      }
      const q = input.value.trim();
      if (!q) return;
      if (host.dataset.searchResultsMissing === "1") return;
      const resultsHrefBase = host.dataset.searchResultsHref ?? "#search";
      const resultsPageId = host.dataset.searchResultsPage ?? "search";
      window.location.assign(withQuery(resultsHrefBase, resultsPageId, q));
    }
  });
  document.addEventListener("click", (event) => {
    if (!host.contains(event.target as Node)) hideSuggest();
  });
}

function ensureSlashFocusShortcut(): void {
  if (slashFocusBound) return;
  slashFocusBound = true;
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingTarget(document.activeElement)) return;
    const boxes = document.querySelectorAll<HTMLElement>("[data-tessera-search='box']");
    for (const box of boxes) {
      if (!isSearchBoxOnScreen(box)) continue;
      const input = box.querySelector<HTMLInputElement>(".tessera-search-input");
      if (!input) continue;
      event.preventDefault();
      input.focus();
      void ensureIndex(box);
      return;
    }
  });
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

function isSearchBoxOnScreen(host: HTMLElement): boolean {
  if (!host.isConnected) return false;
  if (host.closest("[hidden]")) return false;
  const style = getComputedStyle(host);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = host.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  return (
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth
  );
}

function wireResults(host: HTMLElement): void {
  const form = host.querySelector<HTMLFormElement>(".tessera-search-refine");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    applyResults(host, true);
  });
  host.querySelectorAll("select").forEach((el) => {
    el.addEventListener("change", () => applyResults(host, true));
  });
  const input = host.querySelector<HTMLInputElement>(".tessera-search-input");
  let timer: ReturnType<typeof setTimeout> | undefined;
  input?.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => applyResults(host, true), 180);
  });
  syncResultsFromUrl(host);
}

function syncResultsFromUrl(host: HTMLElement): void {
  const params = queryParams();
  const input = host.querySelector<HTMLInputElement>(".tessera-search-input");
  const tag = host.querySelector<HTMLSelectElement>(".tessera-search-tag");
  const type = host.querySelector<HTMLSelectElement>(".tessera-search-type");
  const sort = host.querySelector<HTMLSelectElement>(".tessera-search-sort");
  if (input && params.q !== undefined) input.value = params.q;
  if (tag && params.tag !== undefined) tag.value = params.tag;
  if (type && params.type !== undefined) type.value = params.type;
  if (sort && params.sort !== undefined) sort.value = params.sort === "title" ? "title" : "relevance";
  void applyResults(host, false);
}

async function applyResults(host: HTMLElement, pushUrl: boolean): Promise<void> {
  const input = host.querySelector<HTMLInputElement>(".tessera-search-input");
  const tagEl = host.querySelector<HTMLSelectElement>(".tessera-search-tag");
  const typeEl = host.querySelector<HTMLSelectElement>(".tessera-search-type");
  const sortEl = host.querySelector<HTMLSelectElement>(".tessera-search-sort");
  const status = host.querySelector<HTMLElement>(".tessera-search-status");
  const list = host.querySelector<HTMLElement>(".tessera-search-list");
  if (!list) return;

  const q = input?.value.trim() ?? "";
  const tag = tagEl?.value.trim() ?? "";
  const type = typeEl?.value.trim() ?? "";
  const sort = sortEl?.value === "title" ? "title" : "relevance";

  if (pushUrl) {
    updateResultsUrl(host, { q, tag, type, sort });
  }

  if (!q) {
    list.innerHTML = "";
    if (status) status.textContent = "Enter a search query.";
    return;
  }

  if (status) status.textContent = "Searching…";
  const loaded = await ensureIndex(host);
  if (!loaded) {
    list.innerHTML = "";
    if (status) status.textContent = "Search index unavailable.";
    return;
  }

  fillFilterOptions(host, loaded.facets);
  if (tagEl && tag) tagEl.value = tag;
  if (typeEl && type) typeEl.value = type;

  const hits = runSearch(loaded.mini, {
    query: q,
    limit: RESULTS_LIMIT,
    ...(tag ? { tag } : {}),
    ...(type ? { type } : {}),
    sort,
  });
  list.innerHTML = hits.map((hit) => resultRow(hit, pageHrefFromHost(host, hit))).join("");
  if (status) {
    status.textContent = hits.length
      ? `${hits.length} result${hits.length === 1 ? "" : "s"}`
      : "No matches.";
  }
}

function fillFilterOptions(host: HTMLElement, facets: { tags: string[]; types: string[] }): void {
  const tagEl = host.querySelector<HTMLSelectElement>(".tessera-search-tag");
  const typeEl = host.querySelector<HTMLSelectElement>(".tessera-search-type");
  if (tagEl && tagEl.options.length <= 1) {
    for (const t of facets.tags) {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      tagEl.appendChild(opt);
    }
  }
  if (typeEl && typeEl.options.length <= 1) {
    for (const t of facets.types) {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      typeEl.appendChild(opt);
    }
  }
}

async function ensureIndex(host: HTMLElement): Promise<LoadedIndex | null> {
  const url = host.dataset.searchIndex || "./search-index.json";
  if (indexPromise && indexUrlCached === url) return indexPromise;
  indexUrlCached = url;
  indexPromise = (async () => {
    try {
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) return null;
      const payload = (await res.json()) as SearchIndexPayload;
      if (!payload || payload.version !== 1 || !payload.index) return null;
      return {
        mini: loadSearchEngine(payload),
        facets: payload.facets ?? { tags: [], types: [] },
      };
    } catch {
      return null;
    }
  })();
  return indexPromise;
}

/** Build a visitor href from the index file's relative prefix and the hit path. */
function pageHrefFromHost(host: HTMLElement, hit: SearchHit): string {
  const sample = host.dataset.searchResultsHref ?? "";
  if (sample.startsWith("#")) return `#${hit.id}`;
  const indexUrl = host.dataset.searchIndex || "./search-index.json";
  const prefix = indexUrl.replace(/[^/]*$/, "");
  if (!hit.path) return prefix || "./";
  return `${prefix}${hit.path}/`;
}

function withQuery(resultsHrefBase: string, resultsPageId: string, query: string): string {
  const q = `q=${encodeURIComponent(query)}`;
  if (resultsHrefBase.startsWith("#")) return `#${resultsPageId}?${q}`;
  if (resultsHrefBase.includes("?")) {
    const u = new URL(resultsHrefBase, window.location.href);
    u.searchParams.set("q", query);
    return u.pathname + u.search + u.hash;
  }
  if (resultsHrefBase.endsWith("/")) return `${resultsHrefBase}?${q}`;
  return `${resultsHrefBase}?${q}`;
}

function queryParams(): { q?: string; tag?: string; type?: string; sort?: string } {
  const out: { q?: string; tag?: string; type?: string; sort?: string } = {};
  const hash = window.location.hash.replace(/^#/, "");
  const qIdx = hash.indexOf("?");
  if (qIdx >= 0) {
    const sp = new URLSearchParams(hash.slice(qIdx + 1));
    for (const key of ["q", "tag", "type", "sort"] as const) {
      const v = sp.get(key);
      if (v) out[key] = v;
    }
  }
  const sp = new URLSearchParams(window.location.search);
  for (const key of ["q", "tag", "type", "sort"] as const) {
    const v = sp.get(key);
    if (v) out[key] = v;
  }
  return out;
}

function updateResultsUrl(
  host: HTMLElement,
  state: { q: string; tag: string; type: string; sort: string },
): void {
  const pageId = host.dataset.searchResultsPage ?? "search";
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.tag) params.set("tag", state.tag);
  if (state.type) params.set("type", state.type);
  if (state.sort && state.sort !== "relevance") params.set("sort", state.sort);
  const qs = params.toString();
  const base = host.dataset.searchResultsHref ?? "";
  if (base.startsWith("#") || window.location.hash) {
    const next = qs ? `#${pageId}?${qs}` : `#${pageId}`;
    if (window.location.hash !== next) window.history.replaceState(null, "", next);
    return;
  }
  const url = new URL(window.location.href);
  url.search = qs;
  window.history.replaceState(null, "", url.pathname + url.search);
}

function suggestRow(hit: SearchHit, href: string, listId: string, index: number): string {
  const desc = hit.description || hit.precis;
  const id = `${listId}-opt-${index}`;
  return `<li role="option" id="${escapeAttr(id)}" aria-selected="false"><a href="${escapeAttr(href)}" tabindex="-1"><strong>${escapeText(hit.title)}</strong>${
    desc ? `<span class="w3-small w3-text-grey tessera-search-desc"> — ${escapeText(truncate(desc, 80))}</span>` : ""
  }</a></li>`;
}

function resultRow(hit: SearchHit, href: string): string {
  const desc = hit.description || hit.precis;
  const meta = [hit.type, hit.path].filter(Boolean).join(" · ");
  return `<li class="tessera-search-hit">
  <a href="${escapeAttr(href)}"><strong>${escapeText(hit.title)}</strong></a>
  ${meta ? `<div class="w3-small w3-text-grey">${escapeText(meta)}</div>` : ""}
  ${desc ? `<div class="tessera-search-desc">${escapeText(truncate(desc, 160))}</div>` : ""}
</li>`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}
