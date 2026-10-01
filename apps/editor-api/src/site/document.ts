import type {
  Binding,
  Block,
  Folder,
  Item,
  Layout,
  Media,
  NavEntry,
  Page,
  Type,
  SiteDocument,
  SiteMeta,
} from "@r-a-i-t-h/tessera-model";
import { parseSiteDocument, SITE_DOCUMENT_SCHEMA_VERSION } from "@r-a-i-t-h/tessera-model";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { RecordKind } from "./kinds.js";
import { projectLibrary } from "./library.js";

export type ZoneAuthoring =
  | { html: string }
  | { json: unknown }
  | { component: string; props?: Record<string, unknown> }
  | { blocks: Block[] };

export type AuthoredPage = {
  id: string;
  title: string;
  description?: string;
  slug?: string;
  parentId?: string;
  showInNav?: boolean;
  type?: string;
  fields?: Record<string, string>;
  tags?: string[];
  includes?: string[];
  zones?: Record<string, ZoneAuthoring>;
};

export type AuthoredItem = {
  id: string;
  tags?: string[];
  zones?: Record<string, ZoneAuthoring>;
};

export type SiteFile = SiteMeta & { version?: number };

const YAML_OPTS = { indent: 2, lineWidth: 0, collectionStyle: "block" as const };

export function toYaml(value: unknown): string {
  return stringifyYaml(value, YAML_OPTS).trimEnd() + "\n";
}

export function fromYaml<T>(text: string): T {
  return parseYaml(text) as T;
}

export function zonesToAuthoring(zones: Record<string, Block[]> | undefined): Record<string, ZoneAuthoring> {
  const out: Record<string, ZoneAuthoring> = {};
  for (const [id, blocks] of Object.entries(zones ?? {})) {
    if (blocks.length === 1 && blocks[0]?.type === "text") {
      out[id] = { html: blocks[0].html };
    } else if (blocks.length === 1 && blocks[0]?.type === "json") {
      out[id] = { json: blocks[0].data };
    } else if (blocks.length === 1 && blocks[0]?.type === "component") {
      const block = blocks[0];
      out[id] = {
        component: block.name,
        ...(block.props ? { props: block.props } : {}),
      };
    } else {
      out[id] = { blocks };
    }
  }
  return out;
}

export function authoringToZones(zones: Record<string, ZoneAuthoring> | undefined): Record<string, Block[]> {
  const out: Record<string, Block[]> = {};
  for (const [id, zone] of Object.entries(zones ?? {})) {
    out[id] = zoneToBlocks(zone);
  }
  return out;
}

function zoneToBlocks(zone: ZoneAuthoring): Block[] {
  if ("html" in zone && zone.html !== undefined && !("blocks" in zone) && !("json" in zone) && !("component" in zone)) {
    return [{ type: "text", html: zone.html }];
  }
  if ("json" in zone && !("blocks" in zone) && !("html" in zone) && !("component" in zone)) {
    return [{ type: "json", data: zone.json }];
  }
  if ("component" in zone && zone.component && !("blocks" in zone) && !("html" in zone) && !("json" in zone)) {
    return [
      {
        type: "component",
        name: zone.component,
        ...(zone.props ? { props: zone.props } : {}),
      },
    ];
  }
  if ("blocks" in zone && Array.isArray(zone.blocks)) return zone.blocks;
  throw new Error("Zone must be html, json, component, or blocks.");
}

export function pageToAuthoring(page: Page): AuthoredPage {
  return {
    id: page.id,
    title: page.title,
    ...(page.description ? { description: page.description } : {}),
    ...(page.slug ? { slug: page.slug } : {}),
    ...(page.parentId ? { parentId: page.parentId } : {}),
    ...(page.showInNav === false ? { showInNav: false } : {}),
    ...(page.type ? { type: page.type } : {}),
    ...(page.fields && Object.keys(page.fields).length ? { fields: page.fields } : {}),
    ...(page.tags?.length ? { tags: page.tags } : {}),
    ...(page.includes?.length ? { includes: page.includes } : {}),
    zones: zonesToAuthoring(page.zones),
  };
}

export function itemToAuthoring(item: Item): AuthoredItem {
  return {
    id: item.id,
    ...(item.tags?.length ? { tags: item.tags } : {}),
    zones: zonesToAuthoring(item.zones),
  };
}

export function authoredPageToPage(raw: AuthoredPage): Page {
  return {
    id: raw.id,
    title: raw.title,
    ...(raw.description ? { description: raw.description } : {}),
    ...(raw.slug ? { slug: raw.slug } : {}),
    ...(raw.parentId ? { parentId: raw.parentId } : {}),
    ...(raw.showInNav === false ? { showInNav: false } : {}),
    ...(raw.type ? { type: raw.type } : {}),
    ...(raw.fields && Object.keys(raw.fields).length ? { fields: raw.fields } : {}),
    ...(raw.tags ? { tags: raw.tags } : {}),
    ...(raw.includes ? { includes: raw.includes } : {}),
    zones: authoringToZones(raw.zones),
  };
}

export function authoredItemToItem(raw: AuthoredItem): Item {
  return {
    id: raw.id,
    ...(raw.tags ? { tags: raw.tags } : {}),
    zones: authoringToZones(raw.zones),
  };
}

export type SplitSite = {
  site: SiteFile;
  nav: NavEntry[];
  content: AuthoredPage[];
  items: AuthoredItem[];
  layouts: Layout[];
  bindings: Binding[];
  types: Type[];
  media: Media[];
  folders: Folder[];
};

export function splitDocument(doc: SiteDocument): SplitSite {
  return {
    site: { version: doc.version, ...doc.site },
    nav: doc.nav ?? [],
    content: doc.pages.map(pageToAuthoring),
    items: (doc.items ?? []).map(itemToAuthoring),
    layouts: doc.layouts,
    bindings: doc.bindings ?? [],
    types: doc.types ?? [],
    media: doc.media ?? [],
    folders: doc.folders ?? [],
  };
}

export type LoadedSite = {
  site: SiteFile;
  nav: NavEntry[];
  content: AuthoredPage[];
  items: AuthoredItem[];
  layouts: Layout[];
  bindings: Binding[];
  types: Type[];
  media: Media[];
  folders: Folder[];
};

export function assembleDocument(parts: LoadedSite): SiteDocument {
  const { version: _version, ...meta } = parts.site;
  const version = parts.site.version ?? SITE_DOCUMENT_SCHEMA_VERSION;
  const projected = projectLibrary(parts.media, parts.folders);
  return parseSiteDocument({
    version,
    site: meta,
    layouts: parts.layouts,
    pages: parts.content.map(authoredPageToPage),
    items: parts.items.map(authoredItemToItem),
    media: projected.media,
    folders: projected.folders,
    nav: parts.nav,
    bindings: parts.bindings,
    types: parts.types,
  });
}

export function recordToYaml(kind: RecordKind, record: unknown): string {
  return toYaml(record);
}

export function yamlToRecord(kind: RecordKind, text: string): Record<string, unknown> {
  const value = fromYaml<unknown>(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${kind} file must be a YAML mapping.`);
  }
  return value as Record<string, unknown>;
}
