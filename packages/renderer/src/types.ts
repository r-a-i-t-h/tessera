import type { Block, Page, PageProfile, SiteDocument } from "@r-a-i-t-h/tessera-model";
import type { ComponentRegistry } from "./registry.js";

export type ZoneMap = Map<string, Block[]>;

/** Client mount left in published HTML. The micro-app fills it in the browser. */
export type MicroAppMount = {
  id: string;
  component: string;
  itemId?: string;
  fromZone?: string;
  props?: Record<string, unknown>;
  data?: unknown[];
};

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
  /**
   * When true, bindings and components become empty mounts instead of running.
   * Used by the pages publisher. Snapshot rendering leaves this unset.
   */
  mountMicroApps?: boolean;
  /** Filled when `mountMicroApps` is set. */
  microApps?: MicroAppMount[];
};

export type ComponentFn = (ctx: RenderContext, props?: Record<string, unknown>) => string;

export type ComponentImpl = ComponentFn;
