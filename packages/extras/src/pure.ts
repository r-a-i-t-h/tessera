import type { ComponentFn } from "@r-a-i-t-h/tessera-renderer";
import { hrefForPage } from "@r-a-i-t-h/tessera-renderer";

/** Client-side clock — pure function component. */
export const now: ComponentFn = (_ctx, props = {}) => {
  const style = typeof props.style === "string" ? props.style : "";
  const d = new Date();
  return `<span style="${_ctx.escapeHtml(style)}">${d.toLocaleDateString()} ${d.toLocaleTimeString()}</span>`;
};

/** Build a nav from free-form pages (entries with no type). */
export const pageNav: ComponentFn = (ctx) => {
  const pages = ctx.document.pages.filter((p) => !p.type);
  return pages
    .map((p) => {
      const active = ctx.page.id === p.id ? " font-weight:bold; background:#ddd;" : "";
      return `<a href="${hrefForPage(ctx, p.id)}" style="display:block;padding:8px 12px;margin:2px 0;background:#eee;text-decoration:none;color:#000;${active}">${ctx.escapeHtml(p.title)}</a>`;
    })
    .join("");
};

/** Demo of reading resolved page profile (section inheritance + layout). */
export const aboutRenderer: ComponentFn = (ctx) => {
  const { layoutId, layoutSource, typeId } = ctx.profile;
  const type = typeId ? ` type <code>${ctx.escapeHtml(typeId)}</code>` : "";
  return `<p class="w3-small w3-text-grey">Rendered page <code>${ctx.escapeHtml(ctx.page.id)}</code> with layout <code>${ctx.escapeHtml(layoutId)}</code> (from ${ctx.escapeHtml(layoutSource)}${type}).</p>`;
};

/** Light-DOM card mount. The `rt-card` element is registered with the catalogue. */
export const infoCard: ComponentFn = (ctx, props = {}) => {
  const title = typeof props.title === "string" ? props.title : "Card";
  return `<rt-card title="${ctx.escapeHtml(title)}"><p>Child light-DOM content from the renderer.</p></rt-card>`;
};
