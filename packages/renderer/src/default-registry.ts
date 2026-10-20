import { registerGalleryComponents } from "./builtins/gallery.js";
import { registerHtmlEmbedComponent } from "./builtins/html-embed.js";
import { registerImageRevealGalleryComponents } from "./builtins/image-reveal-gallery.js";
import { registerNavComponents } from "./builtins/nav.js";
import { registerSearchComponents } from "./builtins/search.js";
import { ComponentRegistry } from "./registry.js";
import type { ComponentFn } from "./types.js";

export type RegistryExtension = (
  define: (name: string, fn: ComponentFn) => unknown,
) => void;

/** Shared built-ins used by the snapshot runtime, pages runtime, and publisher. */
export function createDefaultRegistry(extend?: RegistryExtension): ComponentRegistry {
  const registry = new ComponentRegistry();
  const define = (name: string, fn: ComponentFn) => registry.define(name, fn);
  registerNavComponents(define);
  registerGalleryComponents(define);
  registerImageRevealGalleryComponents(define);
  registerSearchComponents(define);
  registerHtmlEmbedComponent(define);
  extend?.(define);
  return registry;
}
