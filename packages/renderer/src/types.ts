import type { Block, Page, PageProfile, SiteDocument } from "@r-a-i-t-h/tessera-model";
import type { ComponentRegistry } from "./registry.js";

export type ZoneMap = Map<string, Block[]>;

export type RenderContext = {
  document: SiteDocument;
  page: Page;
  /** Resolved layout/skin after section inheritance + page override. */
  profile: PageProfile;
  /** All zone contributions for this page (including zones not shown by the layout). */
  zones: ZoneMap;
  registry: ComponentRegistry;
  renderBlocks: (blocks: Block[]) => string;
  /** Read JSON payloads from a zone (for list-style components). */
  zoneJson: <T = unknown>(zoneId: string) => T[];
  mediaHtml: (id: string) => string;
  escapeHtml: (s: string) => string;
};

export type ComponentFn = (ctx: RenderContext, props?: Record<string, unknown>) => string;

export type ComponentImpl = ComponentFn;
