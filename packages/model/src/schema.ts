import { z } from "zod";
import { SiteStyleSchema } from "./style.js";

/** Schema version expected by this package — must match `SiteDocument.version`. */
export const SITE_DOCUMENT_SCHEMA_VERSION = 2 as const;

/** Content blocks that fill zones. */
export const TextBlockSchema = z.object({
  type: z.literal("text"),
  html: z.string(),
});

export const JsonBlockSchema = z.object({
  type: z.literal("json"),
  data: z.unknown(),
});

export const MediaBlockSchema = z.object({
  type: z.literal("media"),
  id: z.string(),
});

/** Inline image slide (gallery / content) — not a catalog lookup. */
export const ImageBlockSchema = z.object({
  type: z.literal("image"),
  url: z.string().min(1),
  caption: z.string().optional(),
  alt: z.string().optional(),
});

export type Block = TextBlock | JsonBlock | MediaBlock | ImageBlock | ComponentBlock;

export type TextBlock = z.infer<typeof TextBlockSchema>;
export type JsonBlock = z.infer<typeof JsonBlockSchema>;
export type MediaBlock = z.infer<typeof MediaBlockSchema>;
export type ImageBlock = z.infer<typeof ImageBlockSchema>;

export type ComponentBlock = {
  type: "component";
  name: string;
  props?: Record<string, unknown>;
};

export const BlockSchema: z.ZodType<Block> = z.lazy(() =>
  z.discriminatedUnion("type", [
    TextBlockSchema,
    JsonBlockSchema,
    MediaBlockSchema,
    ImageBlockSchema,
    z.object({
      type: z.literal("component"),
      name: z.string(),
      props: z.record(z.unknown()).optional(),
    }),
  ]),
);

export const ZonesSchema = z.record(z.array(BlockSchema));

/** Layout tree: the only place that declares which zones exist and where. */
export type LayoutNode =
  | RegionNode
  | ZoneNode
  | StaticNode
  | LayoutComponentNode
  | PageSlotNode;

export type RegionNode = {
  type: "region";
  tag?: string;
  /** Optional element id, for site chrome hooks such as a drawer. */
  id?: string;
  /** Semantic role for skins (e.g. main, sidebar, footer). */
  role?: string;
  className?: string;
  children: LayoutNode[];
};

/** Placeholder in a master layout. Replaced by the page's own layout. */
export type PageSlotNode = {
  type: "page";
};

export type ZoneNode = {
  type: "zone";
  id: string;
  className?: string;
};

export type StaticNode = {
  type: "static";
  html: string;
};

export type LayoutComponentNode = {
  type: "component";
  name: string;
  props?: Record<string, unknown>;
  children?: LayoutNode[];
};

export const LayoutNodeSchema: z.ZodType<LayoutNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("region"),
      tag: z.string().optional(),
      id: z.string().min(1).optional(),
      role: z.string().optional(),
      className: z.string().optional(),
      children: z.array(LayoutNodeSchema),
    }),
    z.object({
      type: z.literal("zone"),
      id: z.string().min(1),
      className: z.string().optional(),
    }),
    z.object({
      type: z.literal("static"),
      html: z.string(),
    }),
    z.object({
      type: z.literal("component"),
      name: z.string().min(1),
      props: z.record(z.unknown()).optional(),
      children: z.array(LayoutNodeSchema).optional(),
    }),
    z.object({
      type: z.literal("page"),
    }),
  ]),
);

export const LayoutSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  root: LayoutNodeSchema,
});

export const PageSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  /** Meta description for a published HTML page. Empty when omitted. */
  description: z.string().optional(),
  /**
   * URL path segment. When omitted, the pages publisher uses `id`.
   * The home page is always the site root, ignoring `slug`.
   */
  slug: z.string().optional(),
  /**
   * Parent page id in the published tree. Omitted pages are roots.
   * The home page is always a root; its `parentId` is ignored.
   * Drafts are pages left out of the published document, not a status on this record.
   */
  parentId: z.string().min(1).optional(),
  /**
   * When `false`, the page still has a URL and an HTML file, and is omitted from nav.
   * Omitted means the page appears in nav. History is not stored here.
   */
  showInNav: z.boolean().optional(),
  /**
   * Explicit layout override. When omitted, resolved from matching `sections`
   * then `site.defaultLayoutId` (see `resolvePageProfile`).
   */
  layoutId: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  /** Shared items whose zone contributions are merged in order. */
  includes: z.array(z.string()).optional(),
  zones: ZonesSchema.default({}),
});

/**
 * Match criteria for a section profile. Present fields are ANDed:
 * - `tags`: page must include at least one listed tag
 * - `pageIdPrefix`: `page.id` must start with this string
 * An empty match object matches every page (useful as a root section).
 */
export const SectionMatchSchema = z.object({
  tags: z.array(z.string().min(1)).optional(),
  pageIdPrefix: z.string().min(1).optional(),
});

export type SectionMatch = z.infer<typeof SectionMatchSchema>;

/**
 * Hierarchical presentation profile: switch layout for a slice of the site
 * without recursive content templates. Only layouts declare zones.
 */
export type Section = {
  id: string;
  title?: string;
  match: SectionMatch;
  layoutId?: string;
  children?: Section[];
};

export const SectionSchema: z.ZodType<Section, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    title: z.string().optional(),
    match: SectionMatchSchema.default({}),
    layoutId: z.string().min(1).optional(),
    children: z.array(SectionSchema).optional(),
  }),
);

export const ItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  zones: ZonesSchema.default({}),
});

export const MediaSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  url: z.string().min(1),
  type: z.enum(["image", "img", "jpg", "png", "gif", "webp", "svg", "document", "pdf"]).optional(),
  alt: z.string().optional(),
  /** Optional caption for gallery / lightbox (may differ from title). */
  caption: z.string().optional(),
  /** Optional sort key; flatten tools often derive from filename. */
  sort: z.number().optional(),
});

/**
 * One image inside a scanned folder record.
 * Order = array order (from filename sort at scan time). Caption defaults from filename.
 */
export const FolderImageSchema = z.object({
  file: z.string().min(1),
  /** Site-root-relative URL. When set, gallery uses this instead of `path` + `file`. */
  url: z.string().min(1).optional(),
  caption: z.string().optional(),
  alt: z.string().optional(),
});

/**
 * First-class scanned folder — discrete gallery source (not a flat media bank).
 * Gallery components reference folder id(s); optional regex filter on `file`.
 */
export const FolderSchema = z.object({
  id: z.string().min(1),
  /** URL prefix for files, e.g. `./media/goats`. */
  path: z.string().min(1),
  title: z.string().optional(),
  images: z.array(FolderImageSchema).default([]),
});

/**
 * Site-data binding: name Z → show content X with registered component Y.
 * Insert via `{{id}}` in text HTML or `{ "type": "component", "name": "<id>" }`.
 */
export const BindingSchema = z.object({
  id: z.string().min(1),
  /** Registered component implementation (Y). */
  component: z.string().min(1),
  /** When set, read zones from this item instead of the current page merge. */
  itemId: z.string().optional(),
  /** Zone id whose JSON (or other data) the component reads (often via `fromZone`). */
  fromZone: z.string().optional(),
  props: z.record(z.unknown()).optional(),
});

/**
 * Dynamic children for a nav node — content-implied links.
 * Presentation (tags / tree / collapse) is chosen by a nav *component*, not the system.
 */
export const NavSourceSchema = z.object({
  pagesTag: z.string().min(1).optional(),
  itemsTag: z.string().min(1).optional(),
});

export type NavSource = z.infer<typeof NavSourceSchema>;

export type NavEntry = {
  id?: string;
  title?: string;
  heading?: string;
  fa?: string;
  topbar?: boolean;
  sidebar?: boolean;
  source?: NavSource;
  children?: NavEntry[];
};

export const NavEntrySchema: z.ZodType<NavEntry> = z.lazy(() =>
  z.object({
    id: z.string().optional(),
    title: z.string().optional(),
    heading: z.string().optional(),
    fa: z.string().optional(),
    topbar: z.boolean().optional(),
    sidebar: z.boolean().optional(),
    source: NavSourceSchema.optional(),
    children: z.array(NavEntrySchema).optional(),
  }),
);

export const SiteDeliverySchema = z.enum(["pages", "snapshot"]);

export const SiteMetaSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  homePageId: z.string().min(1),
  defaultLayoutId: z.string().optional(),
  /** Outer page. Its `page` node is replaced by the resolved page layout. */
  masterLayoutId: z.string().min(1).optional(),
  /**
   * Copyable dist. `pages` is one HTML file per page.
   * `snapshot` is the single-index SPA. Omitted means `pages`.
   * The editing preview is always the snapshot and ignores this.
   */
  delivery: SiteDeliverySchema.optional(),
  /** Absolute origin with no path, used for canonical URLs in a pages dist. */
  origin: z.string().optional(),
  /** Chrome tokens. Missing fields use the defaults in `style.ts`. */
  style: SiteStyleSchema.optional(),
  settings: z.record(z.unknown()).optional(),
});

export const SiteDocumentSchema = z.object({
  version: z.literal(SITE_DOCUMENT_SCHEMA_VERSION),
  site: SiteMetaSchema,
  layouts: z.array(LayoutSchema).min(1),
  pages: z.array(PageSchema).min(1),
  items: z.array(ItemSchema).default([]),
  media: z.array(MediaSchema).default([]),
  /** Scanned image folders — first-class gallery sources. */
  folders: z.array(FolderSchema).default([]),
  /** Designed nav (perma). Page existence does not imply a nav entry. */
  nav: z.array(NavEntrySchema).default([]),
  /** Named bindings of data → component for insertion in content. */
  bindings: z.array(BindingSchema).default([]),
  /**
   * Section profiles: hierarchical layout defaults for matching pages.
   * Resolution: site default → matching sections (deeper / later win) → page.layoutId override.
   */
  sections: z.array(SectionSchema).default([]),
});

export type Layout = z.infer<typeof LayoutSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Media = z.infer<typeof MediaSchema>;
export type FolderImage = z.infer<typeof FolderImageSchema>;
export type Folder = z.infer<typeof FolderSchema>;
export type Binding = z.infer<typeof BindingSchema>;
export type SiteMeta = z.infer<typeof SiteMetaSchema>;
export type SiteDocument = z.infer<typeof SiteDocumentSchema>;

/** Effective layout after section inheritance + page override. */
export type PageProfile = {
  layoutId: string;
  /** How `layoutId` was chosen. */
  layoutSource: "page" | "section" | "site";
  /** Deepest matching section id, if any. */
  sectionId?: string;
};

export function sectionMatchesPage(match: SectionMatch, page: Page): boolean {
  const hasTags = Boolean(match.tags?.length);
  const hasPrefix = Boolean(match.pageIdPrefix);
  if (!hasTags && !hasPrefix) return true;
  if (hasTags) {
    const pageTags = page.tags ?? [];
    if (!match.tags!.some((t) => pageTags.includes(t))) return false;
  }
  if (hasPrefix && !page.id.startsWith(match.pageIdPrefix!)) return false;
  return true;
}

/**
 * Resolve layout for a page: site default → matching sections → page override.
 * Layouts remain first-class; sections never invent zones.
 */
export function resolvePageProfile(document: SiteDocument, page: Page): PageProfile {
  let layoutId: string | undefined = document.site.defaultLayoutId;
  let layoutSource: PageProfile["layoutSource"] = "site";
  let sectionId: string | undefined;

  const walk = (sections: Section[]) => {
    for (const section of sections) {
      if (!sectionMatchesPage(section.match, page)) continue;
      if (section.layoutId) {
        layoutId = section.layoutId;
        layoutSource = "section";
      }
      sectionId = section.id;
      if (section.children?.length) walk(section.children);
    }
  };

  walk(document.sections ?? []);

  if (page.layoutId) {
    layoutId = page.layoutId;
    layoutSource = "page";
  }

  if (!layoutId) {
    layoutId = document.layouts[0]?.id;
    if (!layoutId) throw new Error(`No layout available for page ${page.id}`);
    layoutSource = "site";
  }

  return { layoutId, layoutSource, sectionId };
}

/**
 * Caption from filename: strip extension, then a leading ordering prefix (`01-`, `001_`, …),
 * then turn separators into spaces.
 */
export function captionFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  const withoutOrder = base.replace(/^\d+[-_.\s]+/, "");
  const spaced = (withoutOrder || base).replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!spaced) return filename;
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseSiteDocument(data: unknown): SiteDocument {
  return SiteDocumentSchema.parse(data);
}

export function safeParseSiteDocument(data: unknown) {
  return SiteDocumentSchema.safeParse(data);
}

/** Collect zone ids declared by a layout tree. */
export function collectDeclaredZones(node: LayoutNode, into = new Set<string>()): Set<string> {
  switch (node.type) {
    case "zone":
      into.add(node.id);
      break;
    case "region":
      node.children.forEach((c) => collectDeclaredZones(c, into));
      break;
    case "component":
      node.children?.forEach((c) => collectDeclaredZones(c, into));
      break;
    case "static":
    case "page":
      break;
  }
  return into;
}
