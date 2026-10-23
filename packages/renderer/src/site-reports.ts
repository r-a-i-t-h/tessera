import type {
  Binding,
  Block,
  LayoutNode,
  NavEntry,
  Page,
  SiteDocument,
} from "@r-a-i-t-h/tessera-model";
import {
  RUNTIME_MODULE_COMPONENT,
  resolveMasterLayout,
  resolvePageProfile,
} from "@r-a-i-t-h/tessera-model";
import { bindingsById } from "./bindings.js";
import { flattenNav, resolveNavTree } from "./nav-expand.js";
import { buildPageLinkGraph } from "./page-link-graph.js";
import { BINDING_ONLY_COMPONENTS } from "./builtins/html-embed.js";
import type { ComponentRegistry } from "./registry.js";
import { isSiteMediaUrl } from "./assets.js";

/** System folder rescan uses for orphan blobs (matches editor-api `SCANNED_ID`). */
export const SCANNED_FOLDER_ID = "scanned";

const MUSTACHE_RE = /\{\{([a-zA-Z0-9_-]+)\}\}/g;
const MEDIA_URL_RE = /(?:\.\/|\/)?media\/([a-zA-Z0-9._-]+)\.[a-zA-Z0-9]+/gi;
const SRC_HREF_RE = /\s(?:src|href)=["']([^"']+)["']/gi;

/** One maintenance finding with an editor deep-link. */
export type MaintenanceFinding = {
  /** Hash route into the editor SPA (e.g. `#/content/home`). */
  href: string;
  label: string;
  detail?: string;
};

export type AssetUsage = {
  usedMediaIds: Set<string>;
  usedFolderIds: Set<string>;
};

export type MaintenanceReport = {
  orphans: MaintenanceFinding[];
  unusedAssets: MaintenanceFinding[];
  brokenRefs: MaintenanceFinding[];
  unusedItems: MaintenanceFinding[];
  unusedLayouts: MaintenanceFinding[];
  unknownBindings: MaintenanceFinding[];
  unreachableNav: MaintenanceFinding[];
  rescanDrift: {
    danglingMedia: MaintenanceFinding[];
    scannedAssets: MaintenanceFinding[];
  };
};

function contentHref(pageId: string): string {
  return `#/content/${encodeURIComponent(pageId)}`;
}

function itemsHref(id: string): string {
  return `#/items/${encodeURIComponent(id)}`;
}

function layoutsHref(id: string): string {
  return `#/layouts/${encodeURIComponent(id)}`;
}

function libraryHref(folderId?: string): string {
  if (!folderId) return "#/library";
  return `#/library/${encodeURIComponent(folderId)}`;
}

function navHref(): string {
  return "#/records/nav";
}

/** Media id from a site-relative media URL, or undefined. */
export function mediaIdFromUrl(url: string): string | undefined {
  if (!url || !isSiteMediaUrl(url)) return undefined;
  MEDIA_URL_RE.lastIndex = 0;
  const match = MEDIA_URL_RE.exec(url);
  return match?.[1];
}

/** Collect media ids from `src` / `href` attributes that point at `media/…`. */
export function collectMediaIdsFromHtml(html: string): string[] {
  if (!html.includes("media/")) return [];
  const ids: string[] = [];
  SRC_HREF_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SRC_HREF_RE.exec(html)) !== null) {
    const id = mediaIdFromUrl(match[1] ?? "");
    if (id) ids.push(id);
  }
  return ids;
}

function mustacheIds(html: string): string[] {
  const ids: string[] = [];
  for (const match of html.matchAll(MUSTACHE_RE)) {
    ids.push(match[1]!);
  }
  return ids;
}

function folderIdsFromProps(props: Record<string, unknown> | undefined): string[] {
  if (!props) return [];
  const raw = props.folders ?? props.folder;
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  return [];
}

/** Recursively collect media ids buried in binding / component props. */
function mediaIdsFromValue(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    const id = mediaIdFromUrl(value);
    if (id) out.push(id);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) mediaIdsFromValue(item, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      mediaIdsFromValue(child, out);
    }
  }
}

type RefSource = {
  href: string;
  label: string;
};

function walkBlocks(
  blocks: Block[] | undefined,
  onMedia: (id: string) => void,
  onFolder: (id: string) => void,
  onHtml: (html: string) => void,
  onComponent: (name: string, props?: Record<string, unknown>) => void,
): void {
  if (!blocks) return;
  for (const block of blocks) {
    switch (block.type) {
      case "media":
        onMedia(block.id);
        break;
      case "image": {
        const id = mediaIdFromUrl(block.url);
        if (id) onMedia(id);
        break;
      }
      case "text":
        onHtml(block.html);
        break;
      case "component":
        onComponent(block.name, block.props);
        for (const folderId of folderIdsFromProps(block.props)) onFolder(folderId);
        if (block.props) {
          const nested: string[] = [];
          mediaIdsFromValue(block.props, nested);
          for (const id of nested) onMedia(id);
        }
        break;
      case "json":
        break;
      default: {
        const _exhaustive: never = block;
        return _exhaustive;
      }
    }
  }
}

function walkZones(
  zones: Record<string, Block[]> | undefined,
  onMedia: (id: string) => void,
  onFolder: (id: string) => void,
  onHtml: (html: string) => void,
  onComponent: (name: string, props?: Record<string, unknown>) => void,
): void {
  if (!zones) return;
  for (const blocks of Object.values(zones)) {
    walkBlocks(blocks, onMedia, onFolder, onHtml, onComponent);
  }
}

function walkLayoutNode(
  node: LayoutNode,
  onHtml: (html: string) => void,
  onComponent: (name: string, props?: Record<string, unknown>) => void,
): void {
  switch (node.type) {
    case "component":
      onComponent(node.name, node.props);
      for (const child of node.children ?? []) walkLayoutNode(child, onHtml, onComponent);
      break;
    case "static":
      onHtml(node.html);
      break;
    case "region":
      for (const child of node.children) walkLayoutNode(child, onHtml, onComponent);
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

function mediaIdsInFolder(document: SiteDocument, folderId: string): string[] {
  const folder = document.folders.find((f) => f.id === folderId);
  if (!folder) return [];
  const ids: string[] = [];
  for (const image of folder.images) {
    const fromUrl = image.url ? mediaIdFromUrl(image.url) : undefined;
    if (fromUrl) ids.push(fromUrl);
  }
  return ids;
}

/** Folder id that lists this media id in `images`, if any. */
function folderIdForMedia(document: SiteDocument, mediaId: string): string | undefined {
  for (const folder of document.folders) {
    for (const image of folder.images) {
      if (image.url && mediaIdFromUrl(image.url) === mediaId) return folder.id;
    }
  }
  return undefined;
}

/** True when `media.url` looks like a library blob (`./media/<id>.<ext>`). */
export function isLibraryStyleMedia(media: { id: string; url: string }): boolean {
  const id = mediaIdFromUrl(media.url);
  return id === media.id;
}

/**
 * Collect media and folder ids referenced from pages, items, layouts, and bindings.
 */
export function collectAssetUsage(document: SiteDocument): AssetUsage {
  const usedMediaIds = new Set<string>();
  const usedFolderIds = new Set<string>();

  const onMedia = (id: string) => {
    if (id) usedMediaIds.add(id);
  };
  const onFolder = (id: string) => {
    if (id) usedFolderIds.add(id);
  };
  const onHtml = (html: string) => {
    for (const id of collectMediaIdsFromHtml(html)) onMedia(id);
  };
  const onComponent = (_name: string, props?: Record<string, unknown>) => {
    for (const folderId of folderIdsFromProps(props)) onFolder(folderId);
    if (props) {
      const nested: string[] = [];
      mediaIdsFromValue(props, nested);
      for (const id of nested) onMedia(id);
    }
  };

  for (const page of document.pages) {
    walkZones(page.zones, onMedia, onFolder, onHtml, onComponent);
    const hero = page.fields?.hero?.trim();
    if (hero) onMedia(hero);
  }
  for (const item of document.items) {
    walkZones(item.zones, onMedia, onFolder, onHtml, onComponent);
  }
  for (const layout of document.layouts) {
    walkLayoutNode(layout.root, onHtml, onComponent);
  }
  for (const binding of document.bindings ?? []) {
    onComponent(binding.id, binding.props);
  }

  for (const folderId of [...usedFolderIds]) {
    for (const mediaId of mediaIdsInFolder(document, folderId)) {
      usedMediaIds.add(mediaId);
    }
  }

  return { usedMediaIds, usedFolderIds };
}

function includedItemIdsSiteWide(document: SiteDocument): Set<string> {
  const used = new Set<string>();
  for (const page of document.pages) {
    for (const id of page.includes ?? []) used.add(id);
  }
  for (const layout of document.layouts) {
    for (const id of layout.includes ?? []) used.add(id);
  }
  return used;
}

function usedLayoutIds(document: SiteDocument): Set<string> {
  const used = new Set<string>();
  if (document.site.defaultLayoutId) used.add(document.site.defaultLayoutId);
  if (document.site.masterLayoutId) used.add(document.site.masterLayoutId);
  for (const type of document.types ?? []) {
    if (type.layoutId) used.add(type.layoutId);
  }
  for (const page of document.pages) {
    used.add(resolvePageProfile(document, page).layoutId);
    const master = resolveMasterLayout(document, page).layoutId;
    if (master) used.add(master);
    if (page.masterLayoutId) used.add(page.masterLayoutId);
  }
  return used;
}

/**
 * Pages not home, not in resolved nav, with no inbound wiki links.
 * Articles and blog-index pages inherit reachability from a reachable parent blog
 * (blog cards use plain hrefs, not `data-tessera-page`).
 */
export function listOrphanPages(document: SiteDocument): MaintenanceFinding[] {
  const graph = buildPageLinkGraph(document);
  const homeId = document.site.homePageId;
  const inNav = new Set(
    flattenNav(resolveNavTree(document))
      .map((n) => n.id)
      .filter((id): id is string => !!id),
  );

  const pagesById = new Map(document.pages.map((p) => [p.id, p]));
  const reachable = new Set<string>();

  for (const page of document.pages) {
    if (page.id === homeId || inNav.has(page.id) || (graph.incoming.get(page.id) ?? []).length > 0) {
      reachable.add(page.id);
    }
  }

  let grew = true;
  while (grew) {
    grew = false;
    for (const page of document.pages) {
      if (reachable.has(page.id) || !page.parentId) continue;
      const parent = pagesById.get(page.parentId);
      if (!parent || !reachable.has(parent.id)) continue;
      if (page.type === "article" && parent.type === "blog") {
        reachable.add(page.id);
        grew = true;
      } else if (page.type === "blog-index" && parent.type === "blog") {
        reachable.add(page.id);
        grew = true;
      }
    }
  }

  const orphans: MaintenanceFinding[] = [];
  for (const page of document.pages) {
    if (reachable.has(page.id)) continue;
    orphans.push({
      href: contentHref(page.id),
      label: page.title || page.id,
      detail: page.type ? `${page.id} · ${page.type}` : page.id,
    });
  }
  return orphans.sort((a, b) => a.label.localeCompare(b.label));
}

export function listUnusedLibraryAssets(document: SiteDocument): MaintenanceFinding[] {
  const { usedMediaIds } = collectAssetUsage(document);
  const out: MaintenanceFinding[] = [];
  for (const media of document.media) {
    if (!isLibraryStyleMedia(media)) continue;
    if (usedMediaIds.has(media.id)) continue;
    const folderId = folderIdForMedia(document, media.id);
    out.push({
      href: libraryHref(folderId),
      label: media.title || media.id,
      detail: folderId ? `${media.id} · ${folderId}` : media.id,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

type BrokenCollector = {
  findings: MaintenanceFinding[];
  danglingMedia: MaintenanceFinding[];
};

function noteBroken(
  collector: BrokenCollector,
  source: RefSource,
  kind: string,
  targetId: string,
  isMedia: boolean,
): void {
  const finding: MaintenanceFinding = {
    href: source.href,
    label: source.label,
    detail: `${kind}: ${targetId}`,
  };
  collector.findings.push(finding);
  if (isMedia) collector.danglingMedia.push(finding);
}

function collectBrokenFromZones(
  document: SiteDocument,
  zones: Record<string, Block[]> | undefined,
  source: RefSource,
  mediaById: Map<string, { id: string }>,
  folderById: Map<string, { id: string }>,
  collector: BrokenCollector,
): void {
  walkZones(
    zones,
    (id) => {
      if (!mediaById.has(id)) noteBroken(collector, source, "missing media", id, true);
    },
    (id) => {
      if (!folderById.has(id)) noteBroken(collector, source, "missing folder", id, false);
    },
    (html) => {
      for (const id of collectMediaIdsFromHtml(html)) {
        if (!mediaById.has(id)) noteBroken(collector, source, "missing media", id, true);
      }
    },
    (_name, props) => {
      for (const folderId of folderIdsFromProps(props)) {
        if (!folderById.has(folderId)) {
          noteBroken(collector, source, "missing folder", folderId, false);
        }
      }
      if (props) {
        const nested: string[] = [];
        mediaIdsFromValue(props, nested);
        for (const id of nested) {
          if (!mediaById.has(id)) noteBroken(collector, source, "missing media", id, true);
        }
      }
    },
  );
}

export function listBrokenRefs(document: SiteDocument): {
  brokenRefs: MaintenanceFinding[];
  danglingMedia: MaintenanceFinding[];
} {
  const mediaById = new Map(document.media.map((m) => [m.id, m]));
  const folderById = new Map(document.folders.map((f) => [f.id, f]));
  const pagesById = new Map(document.pages.map((p) => [p.id, p]));
  const collector: BrokenCollector = { findings: [], danglingMedia: [] };

  const graph = buildPageLinkGraph(document);
  for (const page of document.pages) {
    const source: RefSource = { href: contentHref(page.id), label: page.title || page.id };
    for (const targetId of graph.outgoing.get(page.id) ?? []) {
      if (!pagesById.has(targetId)) {
        noteBroken(collector, source, "missing page", targetId, false);
      }
    }
    collectBrokenFromZones(document, page.zones, source, mediaById, folderById, collector);
    const hero = page.fields?.hero?.trim();
    if (hero && !mediaById.has(hero)) {
      noteBroken(collector, source, "missing media", hero, true);
    }
  }

  for (const item of document.items) {
    const source: RefSource = { href: itemsHref(item.id), label: item.id };
    collectBrokenFromZones(document, item.zones, source, mediaById, folderById, collector);
  }

  for (const layout of document.layouts) {
    const source: RefSource = { href: layoutsHref(layout.id), label: layout.id };
    walkLayoutNode(
      layout.root,
      (html) => {
        for (const id of collectMediaIdsFromHtml(html)) {
          if (!mediaById.has(id)) noteBroken(collector, source, "missing media", id, true);
        }
      },
      (_name, props) => {
        for (const folderId of folderIdsFromProps(props)) {
          if (!folderById.has(folderId)) {
            noteBroken(collector, source, "missing folder", folderId, false);
          }
        }
        if (props) {
          const nested: string[] = [];
          mediaIdsFromValue(props, nested);
          for (const id of nested) {
            if (!mediaById.has(id)) noteBroken(collector, source, "missing media", id, true);
          }
        }
      },
    );
  }

  const runtimeModuleIds = new Set((document.runtimeModules ?? []).map((m) => m.id));

  for (const binding of document.bindings ?? []) {
    const source: RefSource = {
      href: `#/bindings/${encodeURIComponent(binding.id)}`,
      label: binding.id,
    };
    if (binding.component === RUNTIME_MODULE_COMPONENT) {
      const moduleId = typeof binding.props?.module === "string" ? binding.props.module.trim() : "";
      if (moduleId && !runtimeModuleIds.has(moduleId)) {
        noteBroken(collector, source, "missing runtime module", moduleId, false);
      }
    }
    for (const folderId of folderIdsFromProps(binding.props)) {
      if (!folderById.has(folderId)) {
        noteBroken(collector, source, "missing folder", folderId, false);
      }
    }
    if (binding.props) {
      const nested: string[] = [];
      mediaIdsFromValue(binding.props, nested);
      for (const id of nested) {
        if (!mediaById.has(id)) noteBroken(collector, source, "missing media", id, true);
      }
    }
  }

  const dedupe = (list: MaintenanceFinding[]) => {
    const seen = new Set<string>();
    const out: MaintenanceFinding[] = [];
    for (const f of list) {
      const key = `${f.href}\0${f.detail ?? ""}\0${f.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
    return out.sort((a, b) => (a.detail ?? a.label).localeCompare(b.detail ?? b.label));
  };

  return {
    brokenRefs: dedupe(collector.findings),
    danglingMedia: dedupe(collector.danglingMedia),
  };
}

export function listUnusedItemsAndLayouts(document: SiteDocument): {
  unusedItems: MaintenanceFinding[];
  unusedLayouts: MaintenanceFinding[];
} {
  const usedItems = includedItemIdsSiteWide(document);
  const unusedItems = document.items
    .filter((item) => !usedItems.has(item.id))
    .map((item) => ({
      href: itemsHref(item.id),
      label: item.id,
      detail: "item",
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const usedLayouts = usedLayoutIds(document);
  const unusedLayouts = document.layouts
    .filter((layout) => !usedLayouts.has(layout.id))
    .map((layout) => ({
      href: layoutsHref(layout.id),
      label: layout.id,
      detail: "layout",
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return { unusedItems, unusedLayouts };
}

type UnknownHit = {
  name: string;
  kind: "binding" | "component";
  source: RefSource;
};

function noteUnknown(
  hits: UnknownHit[],
  name: string,
  kind: "binding" | "component",
  source: RefSource,
  byId: Map<string, Binding>,
  registry: ComponentRegistry,
): void {
  const binding = byId.get(name);
  if (binding) {
    if (!registry.has(binding.component)) {
      hits.push({ name: binding.component, kind: "component", source });
    }
    return;
  }
  if (BINDING_ONLY_COMPONENTS.has(name)) {
    hits.push({ name, kind: "component", source });
    return;
  }
  if (registry.has(name)) return;
  // Mustache-style ids that aren't bindings → unknown binding; bare component names → unknown component
  hits.push({ name, kind, source });
}

export function listUnknownBindings(
  document: SiteDocument,
  registry: ComponentRegistry,
): MaintenanceFinding[] {
  const byId = bindingsById(document);
  const hits: UnknownHit[] = [];

  const checkMustache = (html: string, source: RefSource) => {
    for (const id of mustacheIds(html)) {
      noteUnknown(hits, id, "binding", source, byId, registry);
    }
  };
  const checkComponent = (name: string, source: RefSource) => {
    noteUnknown(hits, name, "component", source, byId, registry);
  };

  for (const page of document.pages) {
    const source: RefSource = { href: contentHref(page.id), label: page.title || page.id };
    walkZones(
      page.zones,
      () => {},
      () => {},
      (html) => checkMustache(html, source),
      (name) => checkComponent(name, source),
    );
  }
  for (const item of document.items) {
    const source: RefSource = { href: itemsHref(item.id), label: item.id };
    walkZones(
      item.zones,
      () => {},
      () => {},
      (html) => checkMustache(html, source),
      (name) => checkComponent(name, source),
    );
  }
  for (const layout of document.layouts) {
    const source: RefSource = { href: layoutsHref(layout.id), label: layout.id };
    walkLayoutNode(
      layout.root,
      (html) => checkMustache(html, source),
      (name) => checkComponent(name, source),
    );
  }

  // Bindings that exist but point at unknown components (even if unreferenced)
  for (const binding of document.bindings ?? []) {
    if (!registry.has(binding.component)) {
      hits.push({
        name: binding.component,
        kind: "component",
        source: {
          href: `#/bindings/${encodeURIComponent(binding.id)}`,
          label: binding.id,
        },
      });
    }
  }

  const seen = new Set<string>();
  const out: MaintenanceFinding[] = [];
  for (const hit of hits) {
    const key = `${hit.source.href}\0${hit.kind}\0${hit.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      href: hit.source.href,
      label: hit.source.label,
      detail: `unknown ${hit.kind}: ${hit.name}`,
    });
  }
  return out.sort((a, b) => (a.detail ?? "").localeCompare(b.detail ?? ""));
}

function walkAuthoredNav(
  entries: NavEntry[],
  pagesById: Map<string, Page>,
  out: MaintenanceFinding[],
): void {
  for (const entry of entries) {
    if (entry.id && !pagesById.has(entry.id)) {
      out.push({
        href: navHref(),
        label: entry.title?.trim() || entry.id,
        detail: `missing page: ${entry.id}`,
      });
    }
    if (entry.children?.length) walkAuthoredNav(entry.children, pagesById, out);
  }
}

export function listUnreachableNavTargets(document: SiteDocument): MaintenanceFinding[] {
  const pagesById = new Map(document.pages.map((p) => [p.id, p]));
  const out: MaintenanceFinding[] = [];
  walkAuthoredNav(document.nav, pagesById, out);
  return out.sort((a, b) => (a.detail ?? a.label).localeCompare(b.detail ?? b.label));
}

export function listRescanDrift(
  document: SiteDocument,
  danglingMedia: MaintenanceFinding[],
): {
  danglingMedia: MaintenanceFinding[];
  scannedAssets: MaintenanceFinding[];
} {
  const scannedAssets: MaintenanceFinding[] = [];
  for (const mediaId of mediaIdsInFolder(document, SCANNED_FOLDER_ID)) {
    const media = document.media.find((m) => m.id === mediaId);
    scannedAssets.push({
      href: libraryHref(SCANNED_FOLDER_ID),
      label: media?.title || mediaId,
      detail: `${mediaId} · ${SCANNED_FOLDER_ID}`,
    });
  }
  return {
    danglingMedia,
    scannedAssets: scannedAssets.sort((a, b) => a.label.localeCompare(b.label)),
  };
}

/** Run every maintenance report. Pass a registry for unknown-binding detection. */
export function buildMaintenanceReport(
  document: SiteDocument,
  registry: ComponentRegistry,
): MaintenanceReport {
  const orphans = listOrphanPages(document);
  const unusedAssets = listUnusedLibraryAssets(document);
  const { brokenRefs, danglingMedia } = listBrokenRefs(document);
  const { unusedItems, unusedLayouts } = listUnusedItemsAndLayouts(document);
  const unknownBindings = listUnknownBindings(document, registry);
  const unreachableNav = listUnreachableNavTargets(document);
  const rescanDrift = listRescanDrift(document, danglingMedia);

  return {
    orphans,
    unusedAssets,
    brokenRefs,
    unusedItems,
    unusedLayouts,
    unknownBindings,
    unreachableNav,
    rescanDrift,
  };
}
