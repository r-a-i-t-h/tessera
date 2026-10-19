import type {
  Block,
  Binding,
  LayoutNode,
  Page,
  SiteDocument,
} from "@r-a-i-t-h/tessera-model";
import {
  resolveMasterLayout,
  resolvePageProfile,
  type MasterLayoutSource,
  type PageProfile,
  type ResolvedMasterLayout,
} from "@r-a-i-t-h/tessera-model";
import { bindingsById } from "./bindings.js";
import { indexDocument } from "./merge.js";

const MUSTACHE_RE = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

export type EditorRecordKind = "content" | "layouts" | "bindings" | "items" | "types" | "articles";

/** Hash route into the editor SPA. From `/preview/` use `../#/…`. */
export function editorUrl(
  kind: EditorRecordKind,
  id: string,
  opts: { fromPreview?: boolean } = {},
): string {
  const fromPreview = opts.fromPreview ?? true;
  const encoded = encodeURIComponent(id);
  const hash =
    kind === "articles" ? `#/articles/${encoded}` : `#/${kind}/${encoded}`;
  return fromPreview ? `../${hash}` : `/${hash}`;
}

export type ItemIncludeSource = "page" | "pageLayout" | "masterLayout";

export type PageItemRef = {
  id: string;
  source: ItemIncludeSource;
};

export type BindingOnPage = {
  id: string;
  component: string;
  itemId?: string;
  fromZone?: string;
  sources: string[];
};

export type PageDiagnosticsPage = {
  id: string;
  title: string;
  type?: string;
  parentId?: string;
  tags?: string[];
  fields?: Record<string, string>;
  showInNav?: boolean;
  previewHash: string;
};

export type PageDiagnosticsBlog = {
  id: string;
  title: string;
  indexPageId?: string;
  indexTitle?: string;
};

export type PageDiagnostics = {
  page: PageDiagnosticsPage;
  profile: PageProfile;
  master: ResolvedMasterLayout;
  pageLayoutId: string;
  masterLayoutId?: string;
  items: PageItemRef[];
  bindings: BindingOnPage[];
  blog?: PageDiagnosticsBlog;
};

function mustacheBindingIds(html: string): string[] {
  const ids: string[] = [];
  for (const match of html.matchAll(MUSTACHE_RE)) {
    ids.push(match[1]!);
  }
  return ids;
}

function noteBinding(
  map: Map<string, BindingOnPage>,
  binding: Binding,
  source: string,
): void {
  const existing = map.get(binding.id);
  if (existing) {
    if (!existing.sources.includes(source)) existing.sources.push(source);
    return;
  }
  map.set(binding.id, {
    id: binding.id,
    component: binding.component,
    ...(binding.itemId ? { itemId: binding.itemId } : {}),
    ...(binding.fromZone ? { fromZone: binding.fromZone } : {}),
    sources: [source],
  });
}

function walkLayoutBindings(
  node: LayoutNode,
  layoutId: string,
  byId: Map<string, Binding>,
  map: Map<string, BindingOnPage>,
): void {
  switch (node.type) {
    case "component": {
      const binding = byId.get(node.name);
      if (binding) noteBinding(map, binding, `layout:${layoutId}`);
      for (const child of node.children ?? []) {
        walkLayoutBindings(child, layoutId, byId, map);
      }
      break;
    }
    case "static": {
      for (const id of mustacheBindingIds(node.html)) {
        const binding = byId.get(id);
        if (binding) noteBinding(map, binding, `layout:${layoutId}`);
      }
      break;
    }
    case "region":
      for (const child of node.children) {
        walkLayoutBindings(child, layoutId, byId, map);
      }
      break;
    case "zone":
    case "page":
      break;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

function walkBlockBindings(
  blocks: Block[],
  componentSource: string,
  mustacheSource: string,
  byId: Map<string, Binding>,
  map: Map<string, BindingOnPage>,
): void {
  for (const block of blocks) {
    if (block.type === "text") {
      for (const id of mustacheBindingIds(block.html)) {
        const binding = byId.get(id);
        if (binding) noteBinding(map, binding, mustacheSource);
      }
    } else if (block.type === "component") {
      const binding = byId.get(block.name);
      if (binding) noteBinding(map, binding, componentSource);
    }
  }
}

function walkZoneRecord(
  zones: Record<string, Block[]> | undefined,
  componentSource: string,
  mustacheSource: string,
  byId: Map<string, Binding>,
  map: Map<string, BindingOnPage>,
): void {
  if (!zones) return;
  for (const blocks of Object.values(zones)) {
    walkBlockBindings(blocks, componentSource, mustacheSource, byId, map);
  }
}

/** Shared items merged for this page, in merge order (same rules as `mergeZones`). */
export function collectPageItems(document: SiteDocument, page: Page): PageItemRef[] {
  const { itemsById } = indexDocument(document);
  const seen = new Set<string>();
  const out: PageItemRef[] = [];

  const append = (ids: readonly string[] | undefined, source: ItemIncludeSource): void => {
    for (const itemId of ids ?? []) {
      if (seen.has(itemId)) continue;
      seen.add(itemId);
      if (itemsById.has(itemId)) out.push({ id: itemId, source });
    }
  };

  append(page.includes, "page");

  const pageLayoutId = resolvePageProfile(document, page).layoutId;
  const pageLayout = document.layouts.find((layout) => layout.id === pageLayoutId);
  append(pageLayout?.includes, "pageLayout");

  const masterId = resolveMasterLayout(document, page).layoutId;
  if (masterId && masterId !== pageLayoutId) {
    const master = document.layouts.find((layout) => layout.id === masterId);
    append(master?.includes, "masterLayout");
  }

  return out;
}

function resolveBlogSection(
  document: SiteDocument,
  page: Page,
): PageDiagnosticsBlog | undefined {
  const { pagesById } = indexDocument(document);
  const pageType = page.type;

  if (pageType === "blog") {
    const index = document.pages.find(
      (p) => p.type === "blog-index" && p.parentId === page.id,
    );
    return {
      id: page.id,
      title: page.title,
      ...(index ? { indexPageId: index.id, indexTitle: index.title } : {}),
    };
  }

  if (pageType === "blog-index" && page.parentId) {
    const blog = pagesById.get(page.parentId);
    if (!blog || blog.type !== "blog") return undefined;
    return {
      id: blog.id,
      title: blog.title,
      indexPageId: page.id,
      indexTitle: page.title,
    };
  }

  if (pageType === "article" && page.parentId) {
    const blog = pagesById.get(page.parentId);
    if (!blog || blog.type !== "blog") return undefined;
    const index = document.pages.find(
      (p) => p.type === "blog-index" && p.parentId === blog.id,
    );
    return {
      id: blog.id,
      title: blog.title,
      ...(index ? { indexPageId: index.id, indexTitle: index.title } : {}),
    };
  }

  return undefined;
}

export function analyzePageDiagnostics(
  document: SiteDocument,
  pageId: string,
): PageDiagnostics {
  const { pagesById, layoutsById, itemsById } = indexDocument(document);
  const page = pagesById.get(pageId);
  if (!page) throw new Error(`Unknown page: ${pageId}`);

  const profile = resolvePageProfile(document, page);
  const master = resolveMasterLayout(document, page);
  const pageLayout = layoutsById.get(profile.layoutId);
  const masterLayoutId =
    master.layoutId && master.layoutId !== profile.layoutId ? master.layoutId : undefined;

  const byId = bindingsById(document);
  const bindingMap = new Map<string, BindingOnPage>();

  if (pageLayout) {
    walkLayoutBindings(pageLayout.root, profile.layoutId, byId, bindingMap);
  }
  if (masterLayoutId) {
    const masterLayout = layoutsById.get(masterLayoutId);
    if (masterLayout) {
      walkLayoutBindings(masterLayout.root, masterLayoutId, byId, bindingMap);
    }
  }

  walkZoneRecord(page.zones, `page:${page.id}`, "mustache", byId, bindingMap);

  const items = collectPageItems(document, page);
  for (const { id: itemId } of items) {
    const item = itemsById.get(itemId);
    walkZoneRecord(item?.zones, `item:${itemId}`, "mustache", byId, bindingMap);
  }

  const blog = resolveBlogSection(document, page);

  return {
    page: {
      id: page.id,
      title: page.title,
      ...(page.type ? { type: page.type } : {}),
      ...(page.parentId ? { parentId: page.parentId } : {}),
      ...(page.tags?.length ? { tags: page.tags } : {}),
      ...(page.fields && Object.keys(page.fields).length ? { fields: page.fields } : {}),
      ...(page.showInNav !== undefined ? { showInNav: page.showInNav } : {}),
      previewHash: `#${page.id}`,
    },
    profile,
    master,
    pageLayoutId: profile.layoutId,
    ...(masterLayoutId ? { masterLayoutId } : {}),
    items,
    bindings: [...bindingMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
    ...(blog ? { blog } : {}),
  };
}

export function masterLayoutSourceLabel(source: MasterLayoutSource): string {
  switch (source) {
    case "page":
      return "this page";
    case "ancestor":
      return "ancestor page";
    case "site":
      return "site default";
    default: {
      const _exhaustive: never = source;
      return _exhaustive;
    }
  }
}

/** Same wording as the master layout source line. */
export function aspectSourceLabel(source: "page" | "ancestor" | "site"): string {
  return masterLayoutSourceLabel(source);
}
