import { z } from "zod";

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

export type Block = TextBlock | JsonBlock | MediaBlock | ComponentBlock;

export type TextBlock = z.infer<typeof TextBlockSchema>;
export type JsonBlock = z.infer<typeof JsonBlockSchema>;
export type MediaBlock = z.infer<typeof MediaBlockSchema>;

export type ComponentBlock = {
  type: "component";
  name: string;
  props?: Record<string, unknown>;
  /** Nested zone contributions for components that expose slots. */
  zones?: Record<string, Block[]>;
};

export const BlockSchema: z.ZodType<Block> = z.lazy(() =>
  z.discriminatedUnion("type", [
    TextBlockSchema,
    JsonBlockSchema,
    MediaBlockSchema,
    z.object({
      type: z.literal("component"),
      name: z.string(),
      props: z.record(z.unknown()).optional(),
      zones: z.record(z.array(BlockSchema)).optional(),
    }),
  ]),
);

export const ZonesSchema = z.record(z.array(BlockSchema));

/** Layout tree: the only place that declares which zones exist and where. */
export type LayoutNode =
  | RegionNode
  | ZoneNode
  | StaticNode
  | LayoutComponentNode;

export type RegionNode = {
  type: "region";
  tag?: string;
  /** Semantic role for skins (e.g. main, sidebar, footer). */
  role?: string;
  className?: string;
  children: LayoutNode[];
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
  slug: z.string().optional(),
  layoutId: z.string().min(1),
  tags: z.array(z.string()).optional(),
  /** Shared items whose zone contributions are merged in order. */
  includes: z.array(z.string()).optional(),
  zones: ZonesSchema.default({}),
});

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
  type: z.enum(["image", "img", "jpg", "png", "gif", "webp", "svg"]).optional(),
  alt: z.string().optional(),
});

export const NavEntrySchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  heading: z.string().optional(),
  fa: z.string().optional(),
  topbar: z.boolean().optional(),
  sidebar: z.boolean().optional(),
});

export const SiteMetaSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  homePageId: z.string().min(1),
  defaultLayoutId: z.string().optional(),
  theme: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
});

export const SiteDocumentSchema = z.object({
  version: z.literal(1),
  site: SiteMetaSchema,
  layouts: z.array(LayoutSchema).min(1),
  pages: z.array(PageSchema).min(1),
  items: z.array(ItemSchema).default([]),
  media: z.array(MediaSchema).default([]),
  nav: z.array(NavEntrySchema).default([]),
});

export type Layout = z.infer<typeof LayoutSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Media = z.infer<typeof MediaSchema>;
export type NavEntry = z.infer<typeof NavEntrySchema>;
export type SiteMeta = z.infer<typeof SiteMetaSchema>;
export type SiteDocument = z.infer<typeof SiteDocumentSchema>;

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
      break;
  }
  return into;
}
