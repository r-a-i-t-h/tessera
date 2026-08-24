import type { ComponentFn, RenderContext } from "./types.js";

/**
 * Site-owned registry: dynamic behaviour lives in TypeScript modules the site
 * imports and registers. The flattened content file only references names + props.
 *
 * @example
 * import { eventList } from "./components/event-list";
 * registry.define("eventList", eventList);
 * // site.json: { "type": "component", "name": "eventList", "props": { "fromZone": "events" } }
 */
export class ComponentRegistry {
  private readonly fns = new Map<string, ComponentFn>();
  private readonly elementTags = new Map<string, string>();

  /** Register a render function (returns HTML string). */
  define(name: string, impl: ComponentFn): this {
    this.fns.set(name, impl);
    return this;
  }

  /**
   * Register a custom element. Renders as `<tag attr="...">children</tag>`.
   * Pass the tag name (must include a hyphen) after defining it with customElements.define.
   */
  defineElement(name: string, tagName: string): this {
    this.elementTags.set(name, tagName);
    return this;
  }

  has(name: string): boolean {
    return this.fns.has(name) || this.elementTags.has(name);
  }

  render(
    name: string,
    ctx: RenderContext,
    props: Record<string, unknown> = {},
    childrenHtml = "",
  ): string {
    const fn = this.fns.get(name);
    if (fn) return fn(ctx, props) ?? "";

    const tag = this.elementTags.get(name);
    if (tag) {
      const attrs = Object.entries(props)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => ` ${escapeAttr(k)}="${escapeAttr(String(v))}"`)
        .join("");
      return `<${tag}${attrs}>${childrenHtml}</${tag}>`;
    }

    return `<!-- unknown component: ${escapeAttr(name)} -->`;
  }
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
