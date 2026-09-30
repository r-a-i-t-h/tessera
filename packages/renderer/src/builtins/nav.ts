import type { Page } from "@r-a-i-t-h/tessera-model";
import type { ComponentFn } from "../types.js";
import { hrefForPage } from "../page-href.js";
import { flattenNav, resolveNavTree, type ResolvedNavNode } from "../nav-expand.js";

function filterScope(nodes: ResolvedNavNode[], scope: string | undefined): ResolvedNavNode[] {
  if (!scope) return nodes;
  return nodes.filter((n) => {
    if (scope === "sidebar") {
      return n.sidebar === true || Boolean(n.heading) || n.children.some((c) => c.sidebar !== false);
    }
    if (scope === "topbar") return n.topbar === true;
    return true;
  });
}

function linkHtml(ctx: Parameters<ComponentFn>[0], node: ResolvedNavNode): string {
  const id = node.id ?? "";
  const href = hrefForPage(ctx, id);
  const active = id && ctx.page.id === id ? " is-active w3-theme-l3" : "";
  const label = ctx.escapeHtml(node.title ?? id);
  return `<a class="w3-bar-item w3-button${active}" href="${href}">${label}</a>`;
}

function renderTreeList(ctx: Parameters<ComponentFn>[0], nodes: ResolvedNavNode[]): string {
  if (!nodes.length) return "";
  const items = nodes
    .map((n) => {
      if (n.heading) {
        const kids = renderTreeList(ctx, n.children);
        return `<li class="tessera-nav-branch"><span class="w3-text-theme">${ctx.escapeHtml(n.heading)}</span>${kids}</li>`;
      }
      if (n.id) {
        const kids = n.children.length ? renderTreeList(ctx, n.children) : "";
        return `<li>${linkHtml(ctx, n)}${kids}</li>`;
      }
      if (n.children.length) {
        return `<li>${renderTreeList(ctx, n.children)}</li>`;
      }
      return "";
    })
    .join("");
  return `<ul class="w3-ul tessera-nav-tree">${items}</ul>`;
}

function collapseBranch(ctx: Parameters<ComponentFn>[0], n: ResolvedNavNode): string {
  if (n.heading) {
    const inner = n.children.map((c) => collapseBranch(ctx, c)).join("");
    return `<details class="w3-margin-bottom tessera-nav-collapse" open>
      <summary class="w3-text-theme w3-padding-small">${ctx.escapeHtml(n.heading)}</summary>
      <div class="w3-padding-small">${inner}</div>
    </details>`;
  }
  if (n.id) {
    const inner = n.children.map((c) => collapseBranch(ctx, c)).join("");
    return `${linkHtml(ctx, n)}${inner}`;
  }
  return n.children.map((c) => collapseBranch(ctx, c)).join("");
}

/** Full designed nav tree (with content-implied `source` children resolved). */
export const navTree: ComponentFn = (ctx, props = {}) => {
  const scope = typeof props.scope === "string" ? props.scope : undefined;
  const tree = filterScope(resolveNavTree(ctx.document), scope);
  if (!tree.length) return `<p class="w3-text-grey"><em>No nav.</em></p>`;
  return renderTreeList(ctx, tree);
};

/** Collapsible regions (details/summary) over the designed nav tree. */
export const navCollapse: ComponentFn = (ctx, props = {}) => {
  const scope = typeof props.scope === "string" ? props.scope : undefined;
  const tree = filterScope(resolveNavTree(ctx.document), scope);
  if (!tree.length) return `<p class="w3-text-grey"><em>No nav.</em></p>`;
  return `<div class="tessera-nav-collapse-root">${tree.map((n) => collapseBranch(ctx, n)).join("")}</div>`;
};

/**
 * Tag-oriented presentation: group pages by tag (not the only nav style).
 * Reads page tags directly — orthogonal to designed nav entries.
 */
export const navTags: ComponentFn = (ctx, props = {}) => {
  const onlyTag = typeof props.tag === "string" ? props.tag : undefined;
  const byTag = new Map<string, { id: string; title: string }[]>();

  for (const page of ctx.document.pages) {
    for (const tag of page.tags ?? []) {
      if (onlyTag && tag !== onlyTag) continue;
      const list = byTag.get(tag) ?? [];
      list.push({ id: page.id, title: page.title });
      byTag.set(tag, list);
    }
  }

  if (byTag.size === 0) {
    return `<p class="w3-text-grey"><em>No tagged pages.</em></p>`;
  }

  const sections = [...byTag.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, pages]) => {
      const pills = pages
        .map((p) => {
          const active = ctx.page.id === p.id ? " w3-theme" : " w3-theme-l4";
          return `<a class="w3-tag w3-round${active} w3-margin-right" href="${hrefForPage(ctx, p.id)}">${ctx.escapeHtml(p.title)}</a>`;
        })
        .join("");
      return `<div class="w3-margin-bottom"><div class="w3-small w3-text-grey">${ctx.escapeHtml(tag)}</div>${pills}</div>`;
    })
    .join("");

  return `<div class="tessera-nav-tags">${sections}</div>`;
};

/** Home, then parentId ancestors, then the current page. */
export const breadcrumbs: ComponentFn = (ctx) => {
  const byId = new Map<string, Page>(ctx.document.pages.map((item) => [item.id, item]));
  const homeId = ctx.document.site.homePageId;
  const trail: { id: string; title: string }[] = [];
  const seen = new Set<string>();
  let current: Page | undefined = byId.get(ctx.page.id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    trail.push({ id: current.id, title: current.title });
    if (current.id === homeId) break;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  trail.reverse();
  if (trail[0]?.id !== homeId && byId.has(homeId)) {
    const home = byId.get(homeId);
    if (home) trail.unshift({ id: homeId, title: home.title });
  }
  if (!trail.length) return "";
  const html = trail
    .map((item, index) => {
      const label = ctx.escapeHtml(item.title);
      if (index === trail.length - 1) return `<span aria-current="page">${label}</span>`;
      return `<a href="${hrefForPage(ctx, item.id)}">${label}</a>`;
    })
    .join(`<span class="tessera-crumb-sep" aria-hidden="true">/</span>`);
  return `<nav class="tessera-breadcrumbs" aria-label="Breadcrumb">${html}</nav>`;
};

/**
 * A content-styled group of links.
 * `source`: `children` (current page's published children), `tag`, or `nav` (a designed heading).
 * `variant`: `list`, `pills`, or `cards`.
 */
export const linkCluster: ComponentFn = (ctx, props = {}) => {
  const source = typeof props.source === "string" ? props.source : "children";
  const variant = props.variant === "pills" || props.variant === "cards" ? props.variant : "list";
  const title = typeof props.title === "string" ? props.title.trim() : "";
  const links = clusterLinks(ctx, source, props);
  if (!links.length) return "";
  const heading = title ? `<h2 class="tessera-links-title">${ctx.escapeHtml(title)}</h2>` : "";
  const items = links
    .map((link) => {
      const href = hrefForPage(ctx, link.id);
      const label = ctx.escapeHtml(link.title);
      if (variant === "cards") return `<a class="tessera-link-card" href="${href}">${label}</a>`;
      if (variant === "pills") return `<a class="tessera-link-pill" href="${href}">${label}</a>`;
      return `<li><a href="${href}">${label}</a></li>`;
    })
    .join("");
  if (variant === "list") {
    return `<nav class="tessera-links tessera-links-list">${heading}<ul>${items}</ul></nav>`;
  }
  return `<nav class="tessera-links tessera-links-${variant}">${heading}<div class="tessera-links-row">${items}</div></nav>`;
};

function clusterLinks(
  ctx: Parameters<ComponentFn>[0],
  source: string,
  props: Record<string, unknown>,
): { id: string; title: string }[] {
  if (source === "tag") {
    const tag = typeof props.tag === "string" ? props.tag : "";
    if (!tag) return [];
    return ctx.document.pages
      .filter((page) => page.tags?.includes(tag))
      .map((page) => ({ id: page.id, title: page.title }));
  }
  if (source === "nav") {
    const heading = typeof props.heading === "string" ? props.heading : "";
    if (!heading) return [];
    const node = findHeading(resolveNavTree(ctx.document), heading);
    return (node?.children ?? [])
      .filter((child) => child.id)
      .map((child) => ({ id: child.id!, title: child.title ?? child.id! }));
  }
  return ctx.document.pages
    .filter((page) => page.parentId === ctx.page.id)
    .map((page) => ({ id: page.id, title: page.title }));
}

function findHeading(nodes: ResolvedNavNode[], heading: string): ResolvedNavNode | undefined {
  for (const node of nodes) {
    if (node.heading === heading) return node;
    const nested = findHeading(node.children, heading);
    if (nested) return nested;
  }
  return undefined;
}

/** Flat sidebar list from designed nav (legacy chrome style, as a component). */
export const navFlat: ComponentFn = (ctx, props = {}) => {
  const scope = typeof props.scope === "string" ? props.scope : "sidebar";
  const flat = flattenNav(resolveNavTree(ctx.document)).filter((n) => {
    if (scope === "sidebar") return n.sidebar === true || Boolean(n.heading);
    if (scope === "topbar") return n.topbar === true;
    return true;
  });
  return flat
    .map((n) => {
      if (n.heading) return `<h4 class="w3-text-theme">${ctx.escapeHtml(n.heading)}</h4>`;
      if (!n.id) return "";
      return linkHtml(ctx, n);
    })
    .join("");
};

/** Current page's children as a W3CSS list. Empty when there are none. */
export const subpageList: ComponentFn = (ctx, props = {}) => {
  const title = typeof props.title === "string" ? props.title.trim() : "";
  const links = ctx.document.pages
    .filter((page) => page.parentId === ctx.page.id)
    .map((page) => ({ id: page.id, title: page.title }));
  if (!links.length) return "";
  const heading = title ? `<h3>${ctx.escapeHtml(title)}</h3>` : "";
  const items = links
    .map((link) => `<li><a href="${hrefForPage(ctx, link.id)}">${ctx.escapeHtml(link.title)}</a></li>`)
    .join("");
  const label = title ? ` aria-label="${ctx.escapeHtml(title)}"` : ` aria-label="Subpages"`;
  return `<nav class="tessera-subpages w3-margin-bottom"${label}>${heading}<ul class="w3-ul w3-hoverable w3-border">${items}</ul></nav>`;
};

export function registerNavComponents(define: (name: string, fn: ComponentFn) => unknown): void {
  define("navTree", navTree);
  define("navCollapse", navCollapse);
  define("navTags", navTags);
  define("navFlat", navFlat);
  define("breadcrumbs", breadcrumbs);
  define("linkCluster", linkCluster);
}
