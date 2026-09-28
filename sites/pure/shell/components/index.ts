import type { ComponentFn, RenderContext } from "@r-a-i-t-h/tessera-renderer";

/** Client-side clock — pure function component. */
export const now: ComponentFn = (_ctx, props = {}) => {
  const style = typeof props.style === "string" ? props.style : "";
  const d = new Date();
  return `<span style="${_ctx.escapeHtml(style)}">${d.toLocaleDateString()} ${d.toLocaleTimeString()}</span>`;
};

/** Build a nav from pages tagged "page" (or all pages). */
export const pageNav: ComponentFn = (ctx) => {
  const pages = ctx.document.pages.filter(
    (p) => !p.tags || p.tags.includes("page") || p.tags.length === 0,
  );
  return pages
    .map((p) => {
      const active = ctx.page.id === p.id ? " font-weight:bold; background:#ddd;" : "";
      return `<a href="#${p.id}" style="display:block;padding:8px 12px;margin:2px 0;background:#eee;text-decoration:none;color:#000;${active}">${ctx.escapeHtml(p.title)}</a>`;
    })
    .join("");
};

/**
 * Custom list from JSON data stored in a zone.
 *
 * Content (site.json) holds the data; this module owns how it is rendered.
 * Layout/page places `{ "type": "component", "name": "eventList", "props": { "fromZone": "events" } }`.
 *
 * The `events` zone need not appear as a layout zone node — contributions still
 * land on ctx.zones so components can read them via ctx.zoneJson("events").
 */
export const eventList: ComponentFn = (ctx, props = {}) => {
  const fromZone = typeof props.fromZone === "string" ? props.fromZone : "events";
  const limit = typeof props.limit === "number" ? props.limit : undefined;

  type EventRow = { title?: string; when?: string; where?: string };
  let rows = ctx.zoneJson<EventRow>(fromZone);
  if (limit !== undefined) rows = rows.slice(0, limit);

  if (rows.length === 0) {
    return `<p class="w3-text-grey"><em>No events.</em></p>`;
  }

  const items = rows
    .map((e) => {
      const title = ctx.escapeHtml(e.title ?? "Untitled");
      const when = e.when ? `<span class="w3-text-grey"> — ${ctx.escapeHtml(e.when)}</span>` : "";
      const where = e.where ? `<div class="w3-small">${ctx.escapeHtml(e.where)}</div>` : "";
      return `<li class="w3-padding-small"><strong>${title}</strong>${when}${where}</li>`;
    })
    .join("");

  return `<ul class="w3-ul w3-border w3-round">${items}</ul>`;
};

/** Demo of reading resolved page profile (section inheritance + layout). */
export const aboutRenderer: ComponentFn = (ctx) => {
  const { layoutId, layoutSource, sectionId, skinId } = ctx.profile;
  const section = sectionId
    ? ` section <code>${ctx.escapeHtml(sectionId)}</code>`
    : "";
  const skin = skinId ? ` skin <code>${ctx.escapeHtml(skinId)}</code>` : "";
  return `<p class="w3-small w3-text-grey">Rendered page <code>${ctx.escapeHtml(ctx.page.id)}</code> with layout <code>${ctx.escapeHtml(layoutId)}</code> (from ${ctx.escapeHtml(layoutSource)}${section}${skin}).</p>`;
};

export function registerSiteComponents(
  define: (name: string, fn: ComponentFn) => unknown,
): void {
  define("now", now);
  define("pageNav", pageNav);
  define("eventList", eventList);
  define("aboutRenderer", aboutRenderer);
}

// silence unused if tree-shaken oddly
export type { RenderContext };
