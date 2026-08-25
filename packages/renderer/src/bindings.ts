import type { Binding, SiteDocument } from "@r-a-i-t-h/tessera-model";
import type { RenderContext, ZoneMap } from "./types.js";

const MUSTACHE_RE = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

export function bindingsById(document: SiteDocument): Map<string, Binding> {
  return new Map((document.bindings ?? []).map((b) => [b.id, b]));
}

function zonesFromItem(document: SiteDocument, itemId: string): ZoneMap {
  const map: ZoneMap = new Map();
  const item = document.items.find((i) => i.id === itemId);
  if (!item?.zones) return map;
  for (const [zoneId, blocks] of Object.entries(item.zones)) {
    map.set(zoneId, blocks);
  }
  return map;
}

function zoneJsonFromMap(zones: ZoneMap, zoneId: string): unknown[] {
  const blocks = zones.get(zoneId) ?? [];
  const out: unknown[] = [];
  for (const b of blocks) {
    if (b.type !== "json") continue;
    if (Array.isArray(b.data)) out.push(...b.data);
    else out.push(b.data);
  }
  return out;
}

/** Render a site-data binding (populated component). */
export function renderBinding(binding: Binding, ctx: RenderContext): string {
  const zones = binding.itemId ? zonesFromItem(ctx.document, binding.itemId) : ctx.zones;
  const subCtx: RenderContext = {
    ...ctx,
    zones,
    zoneJson: <T = unknown>(zoneId: string) => zoneJsonFromMap(zones, zoneId) as T[],
  };
  const props: Record<string, unknown> = {
    ...(binding.props ?? {}),
  };
  if (binding.fromZone) props.fromZone = binding.fromZone;
  return ctx.registry.render(binding.component, subCtx, props);
}

/**
 * Resolve a name as a document binding first, else a registry component.
 */
export function renderNamed(
  name: string,
  ctx: RenderContext,
  props: Record<string, unknown> = {},
  childrenHtml = "",
): string {
  const binding = bindingsById(ctx.document).get(name);
  if (binding) return renderBinding(binding, ctx);
  return ctx.registry.render(name, ctx, props, childrenHtml);
}

/** Expand `{{binding-id}}` placeholders inside authored HTML. */
export function expandMustache(html: string, ctx: RenderContext): string {
  return html.replace(MUSTACHE_RE, (_full, id: string) => {
    const binding = bindingsById(ctx.document).get(id);
    if (!binding) return `<!-- unknown binding: ${id} -->`;
    return renderBinding(binding, ctx);
  });
}
