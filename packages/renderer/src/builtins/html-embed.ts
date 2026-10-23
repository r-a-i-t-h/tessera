import type { ComponentFn } from "../types.js";

/** Passthrough third-party embed markup from a binding's `props.html`. Bindings only — not for layout menus. */
export const htmlEmbed: ComponentFn = (_ctx, props = {}) => {
  return typeof props.html === "string" ? props.html : "";
};

export function registerHtmlEmbedComponent(
  define: (name: string, fn: ComponentFn) => unknown,
): void {
  define("htmlEmbed", htmlEmbed);
}

/** Registry names that must be referenced only via `records/bindings`, not as bare layout components. */
export const BINDING_ONLY_COMPONENTS = new Set(["htmlEmbed", "runtimeModule"]);
