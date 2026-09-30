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

export function registerNavComponents(define: (name: string, fn: ComponentFn) => unknown): void {
  define("navTree", navTree);
  define("navCollapse", navCollapse);
  define("navTags", navTags);
  define("navFlat", navFlat);
}
